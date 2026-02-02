from fastapi import APIRouter, Query

from app.db.postgres import DataBasePool
from app.schemas.treatment import (
    TreatmentCategory,
    TreatmentCategoryListResponse,
    TreatmentItem,
    TreatmentListResponse,
)
from app.utils.storage import build_signed_url

router = APIRouter(prefix="/treatment", tags=["treatment"])


@router.get("/categories", response_model=TreatmentCategoryListResponse)
async def list_categories() -> TreatmentCategoryListResponse:
    """
    Get unique categories with an image key (if any).
    """
    pool = await DataBasePool.get_pool()
    async with pool.acquire() as connection:
        rows = await connection.fetch(
            """
            SELECT DISTINCT ON (category)
              category,
              image_obj_key
            FROM treatment
            WHERE category IS NOT NULL
            ORDER BY category, (image_obj_key IS NULL), treatment_id ASC
            """
        )

    categories = [
        TreatmentCategory(
            category=row["category"],
            image_obj_key=row["image_obj_key"],
            image_url=build_signed_url(row["image_obj_key"]),
        )
        for row in rows
    ]

    return TreatmentCategoryListResponse(categories=categories)


@router.get("", response_model=TreatmentListResponse)
async def list_treatments(
    category: str | None = Query(None, description="Filter by category"),
) -> TreatmentListResponse:
    """
    Get list of treatments, optionally filtered by category.

    Categories: Shape, Meso Therapy, Booster, Botox, Lorient, Vaccine, Biosimulator, Filler
    """
    pool = await DataBasePool.get_pool()
    values = []
    where_clause = ""

    if category:
        values.append(category)
        where_clause = "WHERE category = $1"

    async with pool.acquire() as connection:
        rows = await connection.fetch(
            f"""
            SELECT
              treatment_id,
              name,
              category,
              price,
              description
            FROM treatment
            {where_clause}
            ORDER BY name ASC
            """,
            *values,
        )

        total = len(rows)

    treatments = [
        TreatmentItem(
            treatment_id=row["treatment_id"],
            name=row["name"],
            category=row["category"],
            price=row["price"],
            description=row["description"],
        )
        for row in rows
    ]

    return TreatmentListResponse(treatments=treatments, total=total)
