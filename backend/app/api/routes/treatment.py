from fastapi import APIRouter, Query

from app.db.postgres import DataBasePool
from app.schemas.treatment import TreatmentItem, TreatmentListResponse

router = APIRouter(prefix="/treatment", tags=["treatment"])


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
