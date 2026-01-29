import re
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.db.postgres import DataBasePool
from app.schemas.purchase import (
    PurchaseInvoiceDetailResponse,
    PurchaseInvoiceDraftRequest,
    PurchaseInvoiceDraftResponse,
    PurchaseInvoiceHeader,
    PurchaseInvoiceItemRequest,
    PurchaseInvoiceItemResponse,
    PurchaseInvoiceItemsResponse,
)

router = APIRouter(prefix="/purchase-invoice", tags=["purchase-invoice"])


def _normalize_name(name: str) -> str:
    cleaned = re.sub(r"\s+", " ", name.strip().lower())
    return cleaned


async def _resolve_supplier_id(
    supplier_name: str,
    pool,
) -> int:
    normalized = _normalize_name(supplier_name)
    async with pool.acquire() as connection:
        row = await connection.fetchrow(
            "SELECT supplier_id FROM supplier WHERE name_norm = $1",
            normalized,
        )
        if row:
            return row["supplier_id"]

        row = await connection.fetchrow(
            """
            INSERT INTO supplier (name, description)
            VALUES ($1, $2)
            RETURNING supplier_id
            """,
            supplier_name,
            "DRAFT",
        )
        if row is None:
            raise HTTPException(status_code=500, detail="Failed to create supplier")
        return row["supplier_id"]


@router.post("/draft", response_model=PurchaseInvoiceDraftResponse)
async def create_draft(payload: PurchaseInvoiceDraftRequest) -> PurchaseInvoiceDraftResponse:
    pool = await DataBasePool.get_pool()

    supplier_id = payload.supplier_id
    supplier_name = (payload.supplier_name or "").strip()
    if supplier_name:
        supplier_id = await _resolve_supplier_id(supplier_name, pool)

    async with pool.acquire() as connection:
        row = await connection.fetchrow(
            """
            INSERT INTO purchase_invoice (supplier_id, issue_at)
            VALUES ($1, $2)
            RETURNING purchase_invoice_id, purchase_no
            """,
            supplier_id,
            payload.issue_at,
        )
    if row is None:
        raise HTTPException(status_code=500, detail="Failed to create purchase invoice")

    return PurchaseInvoiceDraftResponse(
        purchase_invoice_id=row["purchase_invoice_id"],
        purchase_no=row["purchase_no"],
    )


@router.patch("/{purchase_invoice_id}", response_model=PurchaseInvoiceHeader)
async def update_draft_header(
    purchase_invoice_id: int,
    payload: PurchaseInvoiceDraftRequest,
) -> PurchaseInvoiceHeader:
    pool = await DataBasePool.get_pool()

    supplier_id = payload.supplier_id
    supplier_name = (payload.supplier_name or "").strip()
    if supplier_name:
        supplier_id = await _resolve_supplier_id(supplier_name, pool)

    async with pool.acquire() as connection:
        row = await connection.fetchrow(
            """
            UPDATE purchase_invoice
            SET supplier_id = $2,
                issue_at = COALESCE($3, issue_at)
            WHERE purchase_invoice_id = $1
            RETURNING purchase_invoice_id, purchase_no, supplier_id, issue_at
            """,
            purchase_invoice_id,
            supplier_id,
            payload.issue_at,
        )
        if row is None:
            raise HTTPException(status_code=404, detail="Purchase invoice not found")

        supplier_name_value = None
        if row["supplier_id"] is not None:
            supplier_row = await connection.fetchrow(
                "SELECT name FROM supplier WHERE supplier_id = $1",
                row["supplier_id"],
            )
            if supplier_row:
                supplier_name_value = supplier_row["name"]

    return PurchaseInvoiceHeader(
        purchase_invoice_id=row["purchase_invoice_id"],
        purchase_no=row["purchase_no"],
        supplier_id=row["supplier_id"],
        supplier_name=supplier_name_value,
        issue_at=row["issue_at"],
    )


@router.get("/{purchase_invoice_id}", response_model=PurchaseInvoiceDetailResponse)
async def get_purchase_invoice(purchase_invoice_id: int) -> PurchaseInvoiceDetailResponse:
    pool = await DataBasePool.get_pool()
    async with pool.acquire() as connection:
        header_row = await connection.fetchrow(
            """
            SELECT pi.purchase_invoice_id,
                   pi.purchase_no,
                   pi.issue_at,
                   pi.supplier_id,
                   s.name AS supplier_name
            FROM purchase_invoice pi
            LEFT JOIN supplier s ON s.supplier_id = pi.supplier_id
            WHERE pi.purchase_invoice_id = $1
            """,
            purchase_invoice_id,
        )
        if header_row is None:
            raise HTTPException(status_code=404, detail="Purchase invoice not found")

        item_rows = await connection.fetch(
            """
            SELECT
              pii.purchase_invoice_id,
              pii.item_id,
              pii.qty,
              pii.purchase_price_per_unit,
              pii.expire_date,
              ic.sku AS item_code,
              ic.name AS item_name,
              ic.variant_name AS item_variant,
              ic.item_type,
              ic.unit
            FROM purchase_invoice_item pii
            JOIN item_catalog ic ON ic.item_id = pii.item_id
            WHERE pii.purchase_invoice_id = $1
            ORDER BY pii.item_id ASC
            """,
            purchase_invoice_id,
        )

    header = PurchaseInvoiceHeader(
        purchase_invoice_id=header_row["purchase_invoice_id"],
        purchase_no=header_row["purchase_no"],
        supplier_id=header_row["supplier_id"],
        supplier_name=header_row["supplier_name"],
        issue_at=header_row["issue_at"],
    )

    items = [
        PurchaseInvoiceItemResponse(
            purchase_invoice_item_id=row["item_id"],
            purchase_invoice_id=row["purchase_invoice_id"],
            item_id=row["item_id"],
            item_code=row["item_code"],
            item_name=row["item_name"],
            item_variant=row["item_variant"],
            item_type=row["item_type"],
            qty=row["qty"],
            unit=row["unit"],
            purchase_price_per_unit=row["purchase_price_per_unit"],
            expire_date=row["expire_date"],
        )
        for row in item_rows
    ]

    return PurchaseInvoiceDetailResponse(header=header, items=items)


@router.get("/{purchase_invoice_id}/items", response_model=PurchaseInvoiceItemsResponse)
async def list_purchase_invoice_items(
    purchase_invoice_id: int,
) -> PurchaseInvoiceItemsResponse:
    pool = await DataBasePool.get_pool()
    async with pool.acquire() as connection:
        item_rows = await connection.fetch(
            """
            SELECT
              pii.purchase_invoice_id,
              pii.item_id,
              pii.qty,
              pii.purchase_price_per_unit,
              pii.expire_date,
              ic.sku AS item_code,
              ic.name AS item_name,
              ic.variant_name AS item_variant,
              ic.item_type,
              ic.unit
            FROM purchase_invoice_item pii
            JOIN item_catalog ic ON ic.item_id = pii.item_id
            WHERE pii.purchase_invoice_id = $1
            ORDER BY pii.item_id ASC
            """,
            purchase_invoice_id,
        )

    items = [
        PurchaseInvoiceItemResponse(
            purchase_invoice_item_id=row["item_id"],
            purchase_invoice_id=row["purchase_invoice_id"],
            item_id=row["item_id"],
            item_code=row["item_code"],
            item_name=row["item_name"],
            item_variant=row["item_variant"],
            item_type=row["item_type"],
            qty=row["qty"],
            unit=row["unit"],
            purchase_price_per_unit=row["purchase_price_per_unit"],
            expire_date=row["expire_date"],
        )
        for row in item_rows
    ]
    return PurchaseInvoiceItemsResponse(items=items)


@router.post("/{purchase_invoice_id}/items", response_model=PurchaseInvoiceItemResponse)
async def add_purchase_invoice_item(
    purchase_invoice_id: int,
    payload: PurchaseInvoiceItemRequest,
) -> PurchaseInvoiceItemResponse:
    pool = await DataBasePool.get_pool()
    item_code = (payload.item_code or "").strip()
    item_name = (payload.item_name or "").strip()
    item_variant = (payload.item_variant or "").strip() or None

    async with pool.acquire() as connection:
        # Resolve item_id by sku or by name+variant+type
        item_row = None
        if item_code:
            item_row = await connection.fetchrow(
                "SELECT item_id FROM item_catalog WHERE sku = $1",
                item_code,
            )
        if item_row is None and item_name:
            if item_variant is None:
                item_row = await connection.fetchrow(
                    """
                    SELECT item_id
                    FROM item_catalog
                    WHERE name = $1 AND variant_name IS NULL AND item_type = $2
                    """,
                    item_name,
                    payload.item_type,
                )
            else:
                item_row = await connection.fetchrow(
                    """
                    SELECT item_id
                    FROM item_catalog
                    WHERE name = $1 AND variant_name = $2 AND item_type = $3
                    """,
                    item_name,
                    item_variant,
                    payload.item_type,
                )

        if item_row is None:
            item_row = await connection.fetchrow(
                """
                INSERT INTO item_catalog (sku, name, variant_name, item_type, unit)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING item_id
                """,
                item_code or None,
                item_name or None,
                item_variant,
                payload.item_type,
                payload.unit,
            )

        if item_row is None:
            raise HTTPException(status_code=500, detail="Failed to resolve item")

        item_id = item_row["item_id"]

        row = await connection.fetchrow(
            """
            INSERT INTO purchase_invoice_item (
              purchase_invoice_id,
              item_id,
              qty,
              expire_date,
              purchase_price_per_unit
            )
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (item_id, purchase_invoice_id)
            DO UPDATE SET
              qty = purchase_invoice_item.qty + EXCLUDED.qty,
              expire_date = COALESCE(EXCLUDED.expire_date, purchase_invoice_item.expire_date),
              purchase_price_per_unit = COALESCE(
                EXCLUDED.purchase_price_per_unit,
                purchase_invoice_item.purchase_price_per_unit
              )
            RETURNING purchase_invoice_id, item_id, qty, expire_date, purchase_price_per_unit
            """,
            purchase_invoice_id,
            item_id,
            payload.qty,
            payload.expire_date,
            payload.purchase_price_per_unit,
        )

        item_meta = await connection.fetchrow(
            """
            SELECT sku, name, variant_name, item_type, unit
            FROM item_catalog
            WHERE item_id = $1
            """,
            item_id,
        )

    if row is None:
        raise HTTPException(status_code=500, detail="Failed to add purchase invoice item")

    return PurchaseInvoiceItemResponse(
        purchase_invoice_item_id=row["item_id"],
        purchase_invoice_id=row["purchase_invoice_id"],
        item_id=row["item_id"],
        item_code=item_meta["sku"] if item_meta else None,
        item_name=item_meta["name"] if item_meta else None,
        item_variant=item_meta["variant_name"] if item_meta else None,
        item_type=item_meta["item_type"] if item_meta else None,
        qty=row["qty"],
        unit=item_meta["unit"] if item_meta else None,
        purchase_price_per_unit=row["purchase_price_per_unit"],
        expire_date=row["expire_date"],
    )


@router.delete("/{purchase_invoice_id}/items/{purchase_invoice_item_id}")
async def delete_purchase_invoice_item(
    purchase_invoice_id: int,
    purchase_invoice_item_id: int,
) -> dict[str, Any]:
    pool = await DataBasePool.get_pool()
    async with pool.acquire() as connection:
        result = await connection.execute(
            """
            DELETE FROM purchase_invoice_item
            WHERE purchase_invoice_id = $1 AND item_id = $2
            """,
            purchase_invoice_id,
            purchase_invoice_item_id,
        )
    return {"status": "ok", "result": result}


@router.post("/{purchase_invoice_id}/confirm")
async def confirm_purchase_invoice(purchase_invoice_id: int) -> dict[str, Any]:
    pool = await DataBasePool.get_pool()
    async with pool.acquire() as connection:
        total_amount = await connection.fetchval(
            """
            SELECT COALESCE(SUM(qty * COALESCE(purchase_price_per_unit, 0)), 0)
            FROM purchase_invoice_item
            WHERE purchase_invoice_id = $1
            """,
            purchase_invoice_id,
        )
        row = await connection.fetchrow(
            """
            UPDATE purchase_invoice
            SET total_amount = $2,
                issue_at = COALESCE(issue_at, now())
            WHERE purchase_invoice_id = $1
            RETURNING purchase_invoice_id, purchase_no, total_amount, issue_at
            """,
            purchase_invoice_id,
            total_amount,
        )

    if row is None:
        raise HTTPException(status_code=404, detail="Purchase invoice not found")

    return {
        "purchase_invoice_id": row["purchase_invoice_id"],
        "purchase_no": row["purchase_no"],
        "total_amount": row["total_amount"],
        "issue_at": row["issue_at"],
    }
