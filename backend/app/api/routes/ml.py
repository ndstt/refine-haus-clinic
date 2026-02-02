"""
ML API Routes
API endpoints สำหรับ Machine Learning features
"""

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.ml.apriori import (
    get_bundle_recommendations,
    get_recommended_bundles_simple,
    save_bundles_to_promotions,
)
from app.services.scheduler import get_scheduler_status, trigger_job_now

router = APIRouter(prefix="/ml", tags=["machine-learning"])


class BundleRecommendation(BaseModel):
    if_buy: list[str]
    then_recommend: list[str]
    bundle: list[str]
    confidence: float
    lift: float
    support: float
    description: str


class BundleResponse(BaseModel):
    success: bool
    total_transactions: int = 0
    total_rules_found: int = 0
    parameters: dict = {}
    recommendations: list[BundleRecommendation] = []
    message: str = ""


class SimpleBundleResponse(BaseModel):
    bundles: list[dict]


@router.get("/bundles", response_model=BundleResponse)
async def get_bundles(
    min_support: float = Query(0.05, ge=0.01, le=1.0, description="Minimum support (0.01-1.0)"),
    min_confidence: float = Query(0.3, ge=0.1, le=1.0, description="Minimum confidence (0.1-1.0)"),
    min_lift: float = Query(1.0, ge=0.5, description="Minimum lift (>= 0.5)"),
    top_n: int = Query(10, ge=1, le=50, description="Number of recommendations to return")
):
    """
    หา Treatment Bundles ที่แนะนำโดยใช้ Apriori Algorithm

    - **min_support**: สัดส่วนขั้นต่ำที่ bundle ต้องปรากฏใน transactions (default 5%)
    - **min_confidence**: ความมั่นใจขั้นต่ำว่าถ้าซื้อ A แล้วจะซื้อ B (default 30%)
    - **min_lift**: ค่า lift ขั้นต่ำ (default 1.0 = ไม่มี negative correlation)
    - **top_n**: จำนวน recommendations ที่ต้องการ (default 10)

    Returns:
    - recommendations: รายการ bundle ที่แนะนำ พร้อมค่า confidence และ lift
    """
    result = await get_bundle_recommendations(
        min_support=min_support,
        min_confidence=min_confidence,
        min_lift=min_lift,
        top_n=top_n
    )

    return BundleResponse(**result)


@router.get("/bundles/simple", response_model=SimpleBundleResponse)
async def get_bundles_simple():
    """
    ดึง Bundle recommendations แบบง่าย (สำหรับแสดงใน Frontend)

    Returns:
    - bundles: รายการ bundle พร้อม treatments และ description
    """
    bundles = await get_recommended_bundles_simple()

    return SimpleBundleResponse(bundles=bundles)


@router.get("/bundles/for-treatment/{treatment_id}")
async def get_bundles_for_treatment(treatment_id: int):
    """
    หา treatments ที่มักถูกซื้อพร้อมกับ treatment ที่ระบุ

    - **treatment_id**: ID ของ treatment ที่ต้องการหา bundle
    """
    from app.db.postgres import DataBasePool

    pool = await DataBasePool.get_pool()

    async with pool.acquire() as connection:
        # หา treatment name
        treatment = await connection.fetchrow(
            "SELECT name FROM treatment WHERE treatment_id = $1",
            treatment_id
        )

        if not treatment:
            return {"success": False, "message": "Treatment not found"}

        treatment_name = treatment["name"]

        # หา treatments ที่ถูกซื้อพร้อมกัน
        rows = await connection.fetch(
            """
            SELECT
                t2.treatment_id,
                t2.name,
                t2.price,
                COUNT(*) as co_purchase_count
            FROM treatment_session ts1
            JOIN treatment_session ts2 ON ts1.sell_invoice_id = ts2.sell_invoice_id
            JOIN treatment t2 ON ts2.treatment_id = t2.treatment_id
            WHERE ts1.treatment_id = $1
              AND ts2.treatment_id != $1
            GROUP BY t2.treatment_id, t2.name, t2.price
            ORDER BY co_purchase_count DESC
            LIMIT 5
            """,
            treatment_id
        )

    recommendations = [
        {
            "treatment_id": row["treatment_id"],
            "name": row["name"],
            "price": float(row["price"]) if row["price"] else 0,
            "co_purchase_count": row["co_purchase_count"],
            "description": f"ลูกค้าที่ทำ {treatment_name} มักทำ {row['name']} ด้วย"
        }
        for row in rows
    ]

    return {
        "success": True,
        "treatment_id": treatment_id,
        "treatment_name": treatment_name,
        "frequently_bought_together": recommendations
    }


class SaveBundlesRequest(BaseModel):
    discount_percent: float = 15.0
    valid_days: int = 30


class CreatedPromotion(BaseModel):
    promotion_id: int
    code: str
    name: str
    discount_percent: float
    treatments: list[str]
    confidence: float
    valid_until: str


class SaveBundlesResponse(BaseModel):
    success: bool
    message: str
    promotions_created: int
    promotions: list[CreatedPromotion] = []


@router.post("/bundles/save-to-promotions", response_model=SaveBundlesResponse)
async def save_bundles_to_promotions_endpoint(
    request: SaveBundlesRequest = SaveBundlesRequest()
):
    """
    🤖 คำนวณ Bundle Recommendations แล้วบันทึกลง Promotion Table

    วิธีการทำงาน:
    1. ใช้ Apriori Algorithm หา treatments ที่ซื้อพร้อมกันบ่อย
    2. สร้าง Promotion พร้อมส่วนลดสำหรับแต่ละ bundle
    3. บันทึกลง promotion, promotion_benefit, promotion_condition tables

    Parameters:
    - **discount_percent**: ส่วนลด % สำหรับ bundle (default 15%)
    - **valid_days**: จำนวนวันที่โปรโมชั่นใช้ได้ (default 30 วัน)

    Returns:
    - รายการ promotions ที่สร้างขึ้น
    """
    result = await save_bundles_to_promotions(
        discount_percent=request.discount_percent,
        valid_days=request.valid_days
    )

    return SaveBundlesResponse(**result)


@router.get("/promotions/ml-generated")
async def get_ml_generated_promotions():
    """
    ดู Promotions ที่สร้างจาก ML (code ขึ้นต้นด้วย ML_BUNDLE_)
    """
    from app.db.postgres import DataBasePool

    pool = await DataBasePool.get_pool()

    async with pool.acquire() as connection:
        rows = await connection.fetch(
            """
            SELECT
                p.promotion_id,
                p.code,
                p.name,
                p.description,
                p.start_at,
                p.end_at,
                p.is_active,
                pb.value_percent as discount_percent
            FROM promotion p
            LEFT JOIN promotion_benefit pb ON p.promotion_id = pb.promotion_id
            WHERE p.code LIKE 'ML_BUNDLE_%'
            ORDER BY p.created_at DESC
            """
        )

    promotions = [
        {
            "promotion_id": row["promotion_id"],
            "code": row["code"],
            "name": row["name"],
            "description": row["description"],
            "start_at": row["start_at"].isoformat() if row["start_at"] else None,
            "end_at": row["end_at"].isoformat() if row["end_at"] else None,
            "is_active": row["is_active"],
            "discount_percent": float(row["discount_percent"]) if row["discount_percent"] else 0
        }
        for row in rows
    ]

    return {
        "success": True,
        "total": len(promotions),
        "promotions": promotions
    }


# ==================== Scheduler Endpoints ====================


@router.get("/scheduler/status")
async def get_scheduler_status_endpoint():
    """
    ดูสถานะ Scheduler และ Jobs ทั้งหมด
    """
    return get_scheduler_status()


@router.post("/scheduler/trigger/{job_id}")
async def trigger_job_endpoint(job_id: str):
    """
    รัน Job ทันที (Manual Trigger)

    Available job_ids:
    - **ml_bundle_weekly**: คำนวณ ML Bundle แล้วบันทึกลง promotion
    """
    result = await trigger_job_now(job_id)
    return result
