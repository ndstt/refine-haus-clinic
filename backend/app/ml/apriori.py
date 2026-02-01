"""
Apriori Algorithm for finding treatment bundles
ใช้หา treatments ที่มักถูกซื้อพร้อมกัน เพื่อสร้าง Bundle Promotions
"""

import pandas as pd
from mlxtend.frequent_patterns import apriori, association_rules
from mlxtend.preprocessing import TransactionEncoder

from app.db.postgres import DataBasePool


async def get_transactions() -> list[list[str]]:
    """
    ดึงข้อมูล transactions จาก database
    แต่ละ transaction = list ของ treatment names ที่ถูกซื้อใน invoice เดียวกัน
    """
    pool = await DataBasePool.get_pool()

    async with pool.acquire() as connection:
        # ดึง treatments ที่อยู่ใน invoice เดียวกัน
        rows = await connection.fetch(
            """
            SELECT
                ts.sell_invoice_id,
                t.name as treatment_name
            FROM treatment_session ts
            JOIN treatment t ON ts.treatment_id = t.treatment_id
            ORDER BY ts.sell_invoice_id
            """
        )

    # Group by sell_invoice_id
    transactions_dict: dict[int, list[str]] = {}
    for row in rows:
        invoice_id = row["sell_invoice_id"]
        treatment_name = row["treatment_name"]

        if invoice_id not in transactions_dict:
            transactions_dict[invoice_id] = []
        transactions_dict[invoice_id].append(treatment_name)

    # Convert to list of lists (เฉพาะ transactions ที่มีมากกว่า 1 item)
    transactions = [items for items in transactions_dict.values() if len(items) > 1]

    return transactions


def run_apriori(
    transactions: list[list[str]],
    min_support: float = 0.1,
    min_confidence: float = 0.5,
    min_lift: float = 1.0
) -> pd.DataFrame:
    """
    รัน Apriori algorithm หา association rules

    Parameters:
    - min_support: สัดส่วนขั้นต่ำที่ itemset ต้องปรากฏ (default 10%)
    - min_confidence: ความมั่นใจขั้นต่ำของ rule (default 50%)
    - min_lift: lift ขั้นต่ำ (default 1.0 = ไม่มี negative correlation)

    Returns:
    - DataFrame ของ association rules
    """
    if not transactions:
        return pd.DataFrame()

    # Transform transactions to one-hot encoded format
    te = TransactionEncoder()
    te_array = te.fit(transactions).transform(transactions)
    df = pd.DataFrame(te_array, columns=te.columns_)

    # Find frequent itemsets
    frequent_itemsets = apriori(df, min_support=min_support, use_colnames=True)

    if frequent_itemsets.empty:
        return pd.DataFrame()

    # Generate association rules
    rules = association_rules(
        frequent_itemsets,
        metric="confidence",
        min_threshold=min_confidence
    )

    # Filter by lift
    rules = rules[rules["lift"] >= min_lift]

    # Sort by lift (highest first)
    rules = rules.sort_values("lift", ascending=False)

    return rules


def format_bundle_recommendations(rules: pd.DataFrame, top_n: int = 10) -> list[dict]:
    """
    แปลง association rules เป็น bundle recommendations
    """
    if rules.empty:
        return []

    recommendations = []

    for _, row in rules.head(top_n).iterrows():
        antecedents = list(row["antecedents"])
        consequents = list(row["consequents"])

        recommendations.append({
            "if_buy": antecedents,
            "then_recommend": consequents,
            "bundle": antecedents + consequents,
            "confidence": round(row["confidence"] * 100, 1),  # เป็น %
            "lift": round(row["lift"], 2),
            "support": round(row["support"] * 100, 1),  # เป็น %
            "description": f"ลูกค้าที่ซื้อ {', '.join(antecedents)} มักซื้อ {', '.join(consequents)} ด้วย ({row['confidence']*100:.0f}%)"
        })

    return recommendations


async def get_bundle_recommendations(
    min_support: float = 0.05,
    min_confidence: float = 0.3,
    min_lift: float = 1.0,
    top_n: int = 10
) -> dict:
    """
    Main function: ดึงข้อมูล + รัน Apriori + return recommendations
    """
    # 1. Get transactions from database
    transactions = await get_transactions()

    if not transactions:
        return {
            "success": False,
            "message": "ไม่มีข้อมูล transactions เพียงพอ (ต้องมี invoice ที่มีมากกว่า 1 treatment)",
            "total_transactions": 0,
            "recommendations": []
        }

    # 2. Run Apriori
    rules = run_apriori(
        transactions,
        min_support=min_support,
        min_confidence=min_confidence,
        min_lift=min_lift
    )

    # 3. Format recommendations
    recommendations = format_bundle_recommendations(rules, top_n=top_n)

    return {
        "success": True,
        "total_transactions": len(transactions),
        "total_rules_found": len(rules),
        "parameters": {
            "min_support": f"{min_support*100}%",
            "min_confidence": f"{min_confidence*100}%",
            "min_lift": min_lift
        },
        "recommendations": recommendations
    }


async def get_recommended_bundles_simple() -> list[dict]:
    """
    Simplified version: return only bundle suggestions for display
    """
    result = await get_bundle_recommendations(
        min_support=0.03,  # 3% ขึ้นไป
        min_confidence=0.2,  # 20% confidence
        min_lift=1.0,
        top_n=5
    )

    bundles = []
    for rec in result.get("recommendations", []):
        bundles.append({
            "treatments": rec["bundle"],
            "confidence": rec["confidence"],
            "description": rec["description"]
        })

    return bundles


async def save_bundles_to_promotions(
    discount_percent: float = 15.0,
    valid_days: int = 30
) -> dict:
    """
    คำนวณ bundles แล้วบันทึกลง promotion table

    Parameters:
    - discount_percent: ส่วนลด % สำหรับ bundle (default 15%)
    - valid_days: จำนวนวันที่โปรโมชั่นใช้ได้ (default 30 วัน)

    Returns:
    - dict with created promotions info
    """
    from datetime import datetime, timedelta

    # 1. Get bundle recommendations
    result = await get_bundle_recommendations(
        min_support=0.03,
        min_confidence=0.2,
        min_lift=1.0,
        top_n=10
    )

    if not result.get("recommendations"):
        return {
            "success": False,
            "message": "ไม่พบ bundle recommendations",
            "promotions_created": 0
        }

    pool = await DataBasePool.get_pool()
    created_promotions = []

    async with pool.acquire() as connection:
        for i, rec in enumerate(result["recommendations"]):
            bundle_treatments = rec["bundle"]
            confidence = rec["confidence"]

            # Generate unique code
            code = f"ML_BUNDLE_{datetime.now().strftime('%Y%m%d')}_{i+1:02d}"
            name = f"Bundle: {' + '.join(bundle_treatments)}"
            description = (
                f"🤖 AI แนะนำ: {rec['description']}\n"
                f"📊 Confidence: {confidence}%\n"
                f"💰 ส่วนลด: {discount_percent}%"
            )

            start_at = datetime.now()
            end_at = start_at + timedelta(days=valid_days)

            try:
                async with connection.transaction():
                    # Check if similar promotion already exists
                    existing = await connection.fetchrow(
                        """
                        SELECT promotion_id FROM promotion
                        WHERE name = $1 AND is_active = true
                        """,
                        name
                    )

                    if existing:
                        continue  # Skip if already exists

                    # 1. Create promotion
                    promotion_id = await connection.fetchval(
                        """
                        INSERT INTO promotion (code, name, description, is_stackable, start_at, end_at, is_active)
                        VALUES ($1, $2, $3, false, $4, $5, true)
                        RETURNING promotion_id
                        """,
                        code, name, description, start_at, end_at
                    )

                    # 2. Create promotion_benefit (discount)
                    await connection.execute(
                        """
                        INSERT INTO promotion_benefit
                        (promotion_id, benefit_type, target_scope, value_percent)
                        VALUES ($1, 'PERCENT_DISCOUNT', 'INVOICE_TOTAL', $2)
                        """,
                        promotion_id, discount_percent
                    )

                    # 3. Create promotion_condition_group
                    condition_group_id = await connection.fetchval(
                        """
                        INSERT INTO promotion_condition_group (promotion_id, sort_order)
                        VALUES ($1, 1)
                        RETURNING condition_group_id
                        """,
                        promotion_id
                    )

                    # 4. Create condition rules for each treatment in bundle
                    for treatment_name in bundle_treatments:
                        # Get treatment_id from name
                        treatment = await connection.fetchrow(
                            "SELECT treatment_id FROM treatment WHERE name = $1",
                            treatment_name
                        )

                        if treatment:
                            # Use HAS_ITEM rule with treatment_id as item_id
                            await connection.execute(
                                """
                                INSERT INTO promotion_condition_rule
                                (condition_group_id, rule_type, op, item_id, qty_base_unit)
                                VALUES ($1, 'HAS_ITEM', 'GTE', $2, 1)
                                """,
                                condition_group_id, treatment["treatment_id"]
                            )

                    created_promotions.append({
                        "promotion_id": promotion_id,
                        "code": code,
                        "name": name,
                        "discount_percent": discount_percent,
                        "treatments": bundle_treatments,
                        "confidence": confidence,
                        "valid_until": end_at.isoformat()
                    })

            except Exception as e:
                # Log error but continue with other bundles
                print(f"Error creating promotion for bundle {bundle_treatments}: {e}")
                continue

    return {
        "success": True,
        "message": f"สร้าง {len(created_promotions)} promotions จาก ML recommendations",
        "promotions_created": len(created_promotions),
        "promotions": created_promotions
    }
