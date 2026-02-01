from fastapi import APIRouter, HTTPException, Query

from app.db.postgres import DataBasePool
from app.schemas.customer import (
    CustomerOption,
    CustomerSearchResponse,
    CustomerCreateRequest,
    CustomerListResponse,
    CustomerRow,
    CustomerTreatmentResponse,
    CustomerTreatmentRow,
)
from app.schemas.inventory import ItemCatalogItem, ItemCatalogPage
from app.schemas.purchase import SupplierOption, SupplierOptionResponse

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


@router.get("/customers", response_model=CustomerListResponse)
async def list_customers() -> CustomerListResponse:
    pool = await DataBasePool.get_pool()
    async with pool.acquire() as connection:
        rows = await connection.fetch(
            """
            SELECT
              customer_id,
              customer_code,
              full_name,
              nickname,
              phone,
              date_of_birth,
              gender,
              member_wallet_remain
            FROM customer
            ORDER BY full_name ASC NULLS LAST, customer_id ASC
            """
        )
    return CustomerListResponse(items=[CustomerRow(**dict(row)) for row in rows])


@router.post("/customers", response_model=CustomerRow)
async def create_customer(payload: CustomerCreateRequest) -> CustomerRow:
    name = (payload.full_name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="full_name is required")

    pool = await DataBasePool.get_pool()
    async with pool.acquire() as connection:
        row = await connection.fetchrow(
            """
            INSERT INTO customer (full_name, nickname, phone, date_of_birth, gender)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING
              customer_id,
              customer_code,
              full_name,
              nickname,
              phone,
              date_of_birth,
              gender,
              member_wallet_remain
            """,
            name,
            payload.nickname,
            payload.phone,
            payload.date_of_birth,
            payload.gender,
        )
    return CustomerRow(**dict(row))


@router.get("/customers/{customer_id}", response_model=CustomerRow)
async def get_customer(customer_id: int) -> CustomerRow:
    pool = await DataBasePool.get_pool()
    async with pool.acquire() as connection:
        row = await connection.fetchrow(
            """
            SELECT
              customer_id,
              customer_code,
              full_name,
              nickname,
              phone,
              date_of_birth,
              gender,
              member_wallet_remain
            FROM customer
            WHERE customer_id = $1
            """,
            customer_id,
        )
    if not row:
        raise HTTPException(status_code=404, detail="Customer not found")
    return CustomerRow(**dict(row))


@router.get("/customers/{customer_id}/treatments", response_model=CustomerTreatmentResponse)
async def get_customer_treatments(customer_id: int) -> CustomerTreatmentResponse:
    pool = await DataBasePool.get_pool()
    async with pool.acquire() as connection:
        customer_row = await connection.fetchrow(
            """
            SELECT
              customer_id,
              customer_code,
              full_name,
              nickname,
              phone,
              date_of_birth,
              gender,
              member_wallet_remain
            FROM customer
            WHERE customer_id = $1
            """,
            customer_id,
        )
        if not customer_row:
            raise HTTPException(status_code=404, detail="Customer not found")

        rows = await connection.fetch(
            """
            SELECT
              ts.treatment_id,
              t.name AS treatment_name,
              t.image_obj_key,
              ts.session_date,
              ts.age_at_session,
              ts.note,
              ts.next_appointment_date,
              ts.sell_invoice_id
            FROM treatment_session ts
            JOIN treatment t ON t.treatment_id = ts.treatment_id
            WHERE ts.customer_id = $1
            ORDER BY ts.session_date DESC NULLS LAST, ts.treatment_id ASC
            """,
            customer_id,
        )

    return CustomerTreatmentResponse(
        customer=CustomerRow(**dict(customer_row)),
        treatments=[CustomerTreatmentRow(**dict(row)) for row in rows],
    )


@router.get("/supplier", response_model=SupplierOptionResponse)
async def list_suppliers(
    query: str | None = Query(None),
    limit: int = Query(8, ge=1, le=50),
) -> SupplierOptionResponse:
    pool = await DataBasePool.get_pool()
    values = []
    where_clause = ""
    if query:
        values.append(f"%{query.strip()}%")
        where_clause = f"WHERE name ILIKE ${len(values)}"

    async with pool.acquire() as connection:
        rows = await connection.fetch(
            f"""
            SELECT supplier_id, name
            FROM supplier
            {where_clause}
            ORDER BY name ASC
            LIMIT ${len(values) + 1}
            """,
            *values,
            limit,
        )

    return SupplierOptionResponse(
        suppliers=[SupplierOption(**dict(row)) for row in rows]
    )


@router.get("/customer", response_model=CustomerSearchResponse)
async def search_customers(
    query: str | None = Query(None, description="Search by name or customer_code"),
    limit: int = Query(8, ge=1, le=50),
) -> CustomerSearchResponse:
    """
    Search customers by name or customer_code.
    Returns matching customers for autocomplete.
    """
    pool = await DataBasePool.get_pool()
    values = []
    where_clause = ""

    if query:
        search_term = f"%{query.strip()}%"
        values.append(search_term)
        values.append(search_term)
        where_clause = "WHERE full_name ILIKE $1 OR customer_code ILIKE $2"

    async with pool.acquire() as connection:
        rows = await connection.fetch(
            f"""
            SELECT customer_id, customer_code, full_name, nickname
            FROM customer
            {where_clause}
            ORDER BY full_name ASC
            LIMIT ${len(values) + 1}
            """,
            *values,
            limit,
        )

    return CustomerSearchResponse(
        customers=[CustomerOption(**dict(row)) for row in rows]
    )
