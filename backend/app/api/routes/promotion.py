from fastapi import APIRouter
from pydantic import BaseModel

from app.db.postgres import DataBasePool

router = APIRouter(prefix="/promotion", tags=["promotion"])


class PromotionTreatmentItem(BaseModel):
  treatment_id: int
  name: str
  description: str | None = None
  category: str | None = None
  price: float | None = None


class PromotionBundle(BaseModel):
  promotion_id: int
  code: str | None = None
  name: str | None = None
  description: str | None = None
  discount_percent: float = 0
  treatments: list[PromotionTreatmentItem] = []


class PromotionBundleListResponse(BaseModel):
  promotions: list[PromotionBundle]
  total: int


@router.get("/bundles", response_model=PromotionBundleListResponse)
async def list_promotion_bundles() -> PromotionBundleListResponse:
  """
  Return promotions with their required treatment items (for UI/cart).
  """
  pool = await DataBasePool.get_pool()

  async with pool.acquire() as connection:
    rows = await connection.fetch(
      """
      WITH promo_items AS (
        SELECT
          p.promotion_id,
          p.code,
          p.name,
          p.description,
          COALESCE(pb.value_percent, 0) AS discount_percent,
          t.treatment_id,
          t.name AS treatment_name,
          t.description AS treatment_description,
          t.category AS treatment_category,
          t.price AS treatment_price,
          row_number() OVER (
            PARTITION BY p.promotion_id, t.name
            ORDER BY t.price ASC NULLS LAST, t.treatment_id ASC
          ) AS rn
        FROM promotion p
        LEFT JOIN promotion_benefit pb
          ON pb.promotion_id = p.promotion_id
         AND pb.benefit_type = 'PERCENT_DISCOUNT'
        JOIN promotion_condition_group pcg
          ON pcg.promotion_id = p.promotion_id
        JOIN promotion_condition_rule pcr
          ON pcr.condition_group_id = pcg.condition_group_id
         AND pcr.rule_type = 'HAS_ITEM'
        JOIN item_catalog ic
          ON ic.item_id = pcr.item_id
        JOIN treatment_recipe tr
          ON tr.item_id = ic.item_id
        JOIN treatment t
          ON t.treatment_id = tr.treatment_id
        WHERE p.is_active = true
      )
      SELECT *
      FROM promo_items
      WHERE rn = 1
      ORDER BY promotion_id, treatment_name
      """
    )

  promotions: dict[int, PromotionBundle] = {}
  for row in rows:
    promotion_id = row["promotion_id"]
    promo = promotions.get(promotion_id)
    if promo is None:
      promo = PromotionBundle(
        promotion_id=promotion_id,
        code=row["code"],
        name=row["name"],
        description=row["description"],
        discount_percent=float(row["discount_percent"] or 0),
        treatments=[],
      )
      promotions[promotion_id] = promo

    promo.treatments.append(
      PromotionTreatmentItem(
        treatment_id=row["treatment_id"],
        name=row["treatment_name"],
        description=row["treatment_description"],
        category=row["treatment_category"],
        price=float(row["treatment_price"]) if row["treatment_price"] is not None else None,
      )
    )

  promotion_list = list(promotions.values())
  return PromotionBundleListResponse(promotions=promotion_list, total=len(promotion_list))
