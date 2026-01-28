from fastapi import APIRouter, Query

from app.db.postgres import DataBasePool
from app.schemas.inventory import ItemCatalogItem, ItemCatalogPage

# Application domain resources will live under /api/v1/resource/*
router = APIRouter(prefix="/resource", tags=["resource"])


@router.get("/item-catalog", response_model=ItemCatalogPage)
async def list_item_catalog(
    page: int = Query(1, ge=1),
    limit: int = Query(15, ge=1, le=50),
    code: str | None = Query(None),
    name: str | None = Query(None),
    variant: str | None = Query(None),
    item_type: str | None = Query(None),
    status: str | None = Query(None),
    price: float | None = Query(None),
    unit: str | None = Query(None),
) -> ItemCatalogPage:
    offset = (page - 1) * limit
    pool = await DataBasePool.get_pool()
    filters = []
    values = []
    if code:
        filters.append("sku ILIKE $" + str(len(values) + 1))
        values.append(f"%{code}%")
    if name:
        filters.append("name ILIKE $" + str(len(values) + 1))
        values.append(f"%{name}%")
    if variant:
        filters.append("variant_name ILIKE $" + str(len(values) + 1))
        values.append(f"%{variant}%")
    if item_type and item_type != "All":
        filters.append("item_type = $" + str(len(values) + 1))
        values.append(item_type)
    if status and status != "All":
        if status == "Low":
            filters.append(
                "(current_qty IS NOT NULL AND restock_threshold IS NOT NULL AND current_qty <= restock_threshold)"
            )
        else:
            filters.append(
                "NOT (current_qty IS NOT NULL AND restock_threshold IS NOT NULL AND current_qty <= restock_threshold)"
            )
    if unit:
        filters.append("unit::text ILIKE $" + str(len(values) + 1))
        values.append(f"%{unit}%")
    if price is not None:
        filters.append("sell_price = $" + str(len(values) + 1))
        values.append(price)
    where_clause = " AND ".join(filters)
    if where_clause:
        where_clause = "WHERE " + where_clause

    async with pool.acquire() as connection:
        total = await connection.fetchval(
            f"SELECT COUNT(*) FROM item_catalog {where_clause}",
            *values,
        )
        rows = await connection.fetch(
            f"""
            SELECT
              item_id,
              sku,
              name,
              variant_name,
              item_type,
              sell_price,
              unit,
              current_qty,
              restock_threshold
            FROM item_catalog
            {where_clause}
            ORDER BY item_id ASC
            LIMIT ${len(values) + 1} OFFSET ${len(values) + 2}
            """,
            *values,
            limit,
            offset,
        )
    items = []
    for row in rows:
        item_type = row["item_type"]
        if item_type == "MEDICINE":
            item_type = "Medicine"
        elif item_type == "MEDICAL_TOOL":
            item_type = "Tool"
        status_value = (
            "Low"
            if row["current_qty"] is not None
            and row["restock_threshold"] is not None
            and row["current_qty"] <= row["restock_threshold"]
            else "Ready"
        )
        items.append(
            ItemCatalogItem(
                item_id=row["item_id"],
                sku=row["sku"],
                name=row["name"],
                variant_name=row["variant_name"],
                item_type=item_type,
                sell_price=row["sell_price"],
                unit=row["unit"],
                current_qty=row["current_qty"],
                status=status_value,
            )
        )
    total_pages = (total + limit - 1) // limit if total else 1
    return ItemCatalogPage(
        items=items,
        total=total or 0,
        page=page,
        limit=limit,
        total_pages=total_pages,
    )
