from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Query

from app.db.postgres import DataBasePool
from app.schemas.purchase import ImportItemRow, ImportItemsResponse

router = APIRouter(prefix="/transaction", tags=["transaction"])


@router.get("/import-items", response_model=ImportItemsResponse)
async def list_import_items(
    limit: int = Query(10, ge=1, le=100),
    code: str | None = Query(None),
    name: str | None = Query(None),
    variant: str | None = Query(None),
    item_type: str | None = Query(None),
    supplier_name: str | None = Query(None),
    time_from: date | None = Query(None),
    time_to: date | None = Query(None),
    time_order: str | None = Query("desc"),
    qty_min: float | None = Query(None),
    qty_max: float | None = Query(None),
    buy_price_min: float | None = Query(None),
    buy_price_max: float | None = Query(None),
    expire_from: date | None = Query(None),
    expire_to: date | None = Query(None),
) -> ImportItemsResponse:
    pool = await DataBasePool.get_pool()
    filters: List[str] = []
    values: List[object] = []

    if code:
        filters.append(f"ic.sku ILIKE ${len(values) + 1}")
        values.append(f"%{code}%")
    if name:
        filters.append(f"ic.name ILIKE ${len(values) + 1}")
        values.append(f"%{name}%")
    if variant:
        filters.append(f"ic.variant_name ILIKE ${len(values) + 1}")
        values.append(f"%{variant}%")
    if item_type and item_type != "All":
        filters.append(f"ic.item_type = ${len(values) + 1}")
        values.append(item_type)
    if supplier_name:
        filters.append(f"s.name ILIKE ${len(values) + 1}")
        values.append(f"%{supplier_name}%")
    if time_from:
        filters.append(f"sm.created_at >= ${len(values) + 1}")
        values.append(time_from)
    if time_to:
        filters.append(f"sm.created_at <= ${len(values) + 1}")
        values.append(time_to)
    if qty_min is not None:
        filters.append(f"sm.qty >= ${len(values) + 1}")
        values.append(qty_min)
    if qty_max is not None:
        filters.append(f"sm.qty <= ${len(values) + 1}")
        values.append(qty_max)
    if buy_price_min is not None:
        filters.append(f"pii.purchase_price_per_unit >= ${len(values) + 1}")
        values.append(buy_price_min)
    if buy_price_max is not None:
        filters.append(f"pii.purchase_price_per_unit <= ${len(values) + 1}")
        values.append(buy_price_max)
    if expire_from:
        filters.append(f"pii.expire_date >= ${len(values) + 1}")
        values.append(expire_from)
    if expire_to:
        filters.append(f"pii.expire_date <= ${len(values) + 1}")
        values.append(expire_to)

    where_clause = " AND ".join(filters)
    if where_clause:
        where_clause = "WHERE " + where_clause

    base_filter = "sm.movement_type = 'PURCHASE_IN'"
    if where_clause:
        where_clause = f"WHERE {base_filter} AND " + where_clause.replace("WHERE ", "")
    else:
        where_clause = f"WHERE {base_filter}"

    order_dir = "DESC"
    if isinstance(time_order, str) and time_order.lower() == "asc":
        order_dir = "ASC"

    async with pool.acquire() as connection:
        rows = await connection.fetch(
            f"""
            SELECT
              sm.created_at AS created_at,
              s.name AS supplier_name,
              ic.sku AS item_code,
              ic.name AS item_name,
              ic.variant_name AS item_variant,
              ic.item_type AS item_type,
              sm.qty,
              pii.purchase_price_per_unit,
              pii.expire_date
            FROM stock_movement sm
            JOIN purchase_invoice pi ON pi.purchase_invoice_id = sm.purchase_invoice_id
            LEFT JOIN supplier s ON s.supplier_id = pi.supplier_id
            JOIN item_catalog ic ON ic.item_id = sm.item_id
            LEFT JOIN purchase_invoice_item pii
              ON pii.purchase_invoice_id = sm.purchase_invoice_id
             AND pii.item_id = sm.item_id
            {where_clause}
            ORDER BY sm.created_at {order_dir} NULLS LAST, sm.purchase_invoice_id {order_dir}
            LIMIT ${len(values) + 1}
            """,
            *values,
            limit,
        )

    items = [ImportItemRow(**dict(row)) for row in rows]
    return ImportItemsResponse(items=items)
