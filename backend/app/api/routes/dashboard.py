from fastapi import APIRouter, Query
from decimal import Decimal
from datetime import date, timedelta

from app.db.postgres import DataBasePool
from app.schemas.dashboard import (
    StatsCard,
    RevenueDataPoint,
    RevenueChartResponse,
    AppointmentRow,
    AppointmentsResponse,
    TopTreatmentRow,
    TopTreatmentsResponse,
    PromotionUsedRow,
    PromotionsUsedResponse,
    OutOfStockRow,
    OutOfStockResponse,
    DailyStockRow,
    DailyStockResponse,
    CompletedTodayRow,
    CompletedTodayResponse,
    ExpiringItemRow,
    ExpiringItemsResponse,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=StatsCard)
async def get_stats(
    target_date: date | None = Query(None, description="Target date (default: today)"),
) -> StatsCard:
    """Get dashboard stats cards data for a specific date."""
    selected_date = target_date or date.today()
    prev_date = selected_date - timedelta(days=1)

    pool = await DataBasePool.get_pool()
    async with pool.acquire() as conn:
        # Revenue for selected date
        revenue_today = await conn.fetchval(
            """
            SELECT COALESCE(SUM(final_amount), 0)
            FROM sell_invoice
            WHERE DATE(issue_at) = $1 AND status = 'PAID'
            """,
            selected_date,
        )

        # Revenue previous day (for comparison)
        revenue_yesterday = await conn.fetchval(
            """
            SELECT COALESCE(SUM(final_amount), 0)
            FROM sell_invoice
            WHERE DATE(issue_at) = $1 AND status = 'PAID'
            """,
            prev_date,
        )

        # Appointments for selected date
        appointments_row = await conn.fetchrow(
            """
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE appointment_status = 'INCOMPLETE') AS incomplete,
                COUNT(*) FILTER (WHERE appointment_status = 'COMPLETE') AS complete
            FROM appointment
            WHERE DATE(appointment_time) = $1
            """,
            selected_date,
        )

        # Promotions used on selected date
        promo_row = await conn.fetchrow(
            """
            SELECT
                COUNT(*) AS usage_count,
                COALESCE(SUM(discount_total), 0) AS total_discount
            FROM promotion_redemption
            WHERE DATE(redeemed_at) = $1
            """,
            selected_date,
        )

        # Out of stock count (current, not date-specific)
        out_of_stock = await conn.fetchval(
            """
            SELECT COUNT(*)
            FROM item_catalog
            WHERE current_qty <= 0
            """
        )

    # Calculate change percent
    change_percent = None
    if revenue_yesterday and revenue_yesterday > 0:
        change_percent = float(
            ((revenue_today - revenue_yesterday) / revenue_yesterday) * 100
        )

    return StatsCard(
        revenue_today=revenue_today or Decimal(0),
        revenue_yesterday=revenue_yesterday or Decimal(0),
        revenue_change_percent=change_percent,
        appointments_today=appointments_row["total"] or 0,
        appointments_incomplete=appointments_row["incomplete"] or 0,
        appointments_complete=appointments_row["complete"] or 0,
        promotions_used_today=promo_row["usage_count"] or 0,
        promotions_discount_today=promo_row["total_discount"] or Decimal(0),
        out_of_stock_count=out_of_stock or 0,
    )


@router.get("/revenue-chart", response_model=RevenueChartResponse)
async def get_revenue_chart(
    days: int = Query(7, ge=1, le=90),
    end_date: date | None = Query(None, description="End date (default: today)"),
) -> RevenueChartResponse:
    """Get revenue chart data for the last N days ending on end_date."""
    target_end = end_date or date.today()
    target_start = target_end - timedelta(days=days)

    pool = await DataBasePool.get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
                DATE(issue_at) AS date,
                COALESCE(SUM(final_amount), 0) AS amount
            FROM sell_invoice
            WHERE DATE(issue_at) >= $1 AND DATE(issue_at) <= $2
                AND status = 'PAID'
            GROUP BY DATE(issue_at)
            ORDER BY date ASC
            """,
            target_start,
            target_end,
        )

    # Fill missing dates with 0
    data = []
    total = Decimal(0)
    date_map = {row["date"]: row["amount"] for row in rows}

    for i in range(days, -1, -1):
        d = target_end - timedelta(days=i)
        amount = date_map.get(d, Decimal(0))
        data.append(RevenueDataPoint(date=d, amount=amount))
        total += amount

    return RevenueChartResponse(data=data, total=total)


@router.get("/appointments", response_model=AppointmentsResponse)
async def get_appointments(
    target_date: date | None = Query(None, description="Target date (default: today)"),
) -> AppointmentsResponse:
    """Get appointments for a specific date."""
    selected_date = target_date or date.today()

    pool = await DataBasePool.get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
                a.appointment_id,
                a.appointment_time,
                a.customer_id,
                c.full_name AS customer_name,
                a.appointment_status
            FROM appointment a
            LEFT JOIN customer c ON a.customer_id = c.customer_id
            WHERE DATE(a.appointment_time) = $1
            ORDER BY a.appointment_time ASC
            """,
            selected_date,
        )

    appointments = [AppointmentRow(**dict(row)) for row in rows]
    incomplete = sum(1 for a in appointments if a.appointment_status == "INCOMPLETE")
    complete = sum(1 for a in appointments if a.appointment_status == "COMPLETE")

    return AppointmentsResponse(
        appointments=appointments,
        total=len(appointments),
        incomplete=incomplete,
        complete=complete,
    )


@router.get("/top-treatments", response_model=TopTreatmentsResponse)
async def get_top_treatments(
    limit: int = Query(10, ge=1, le=20),
    target_date: date | None = Query(None, description="Target date"),
    period: str = Query("month", description="Period: day, week, or month"),
) -> TopTreatmentsResponse:
    """Get top treatments for a specific period (day, week, or month)."""
    selected_date = target_date or date.today()

    # Calculate start date based on period
    if period == "day":
        start_date = selected_date
    elif period == "week":
        # Start of week (Monday)
        start_date = selected_date - timedelta(days=selected_date.weekday())
    else:  # month
        start_date = selected_date.replace(day=1)

    pool = await DataBasePool.get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
                ts.treatment_id,
                t.name AS treatment_name,
                COUNT(*) AS count
            FROM treatment_session ts
            JOIN treatment t ON ts.treatment_id = t.treatment_id
            WHERE DATE(ts.session_date) >= $1 AND DATE(ts.session_date) <= $2
            GROUP BY ts.treatment_id, t.name
            ORDER BY count DESC
            LIMIT $3
            """,
            start_date,
            selected_date,
            limit,
        )

    return TopTreatmentsResponse(
        treatments=[TopTreatmentRow(**dict(row)) for row in rows]
    )


@router.get("/promotions-used", response_model=PromotionsUsedResponse)
async def get_promotions_used(
    limit: int = Query(5, ge=1, le=20),
    target_date: date | None = Query(None, description="Target date for month calculation"),
) -> PromotionsUsedResponse:
    """Get promotions used for the month of target_date."""
    selected_date = target_date or date.today()
    month_start = selected_date.replace(day=1)

    pool = await DataBasePool.get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
                pr.promotion_id,
                p.code AS promotion_code,
                p.name AS promotion_name,
                COUNT(*) AS usage_count,
                COALESCE(SUM(pr.discount_total), 0) AS total_discount
            FROM promotion_redemption pr
            JOIN promotion p ON pr.promotion_id = p.promotion_id
            WHERE DATE(pr.redeemed_at) >= $1 AND DATE(pr.redeemed_at) <= $2
            GROUP BY pr.promotion_id, p.code, p.name
            ORDER BY usage_count DESC
            LIMIT $3
            """,
            month_start,
            selected_date,
            limit,
        )

    promotions = [PromotionUsedRow(**dict(row)) for row in rows]
    total_usage = sum(p.usage_count for p in promotions)
    total_discount = sum(p.total_discount for p in promotions)

    return PromotionsUsedResponse(
        promotions=promotions,
        total_usage=total_usage,
        total_discount=total_discount,
    )


@router.get("/out-of-stock", response_model=OutOfStockResponse)
async def get_out_of_stock() -> OutOfStockResponse:
    """Get items that are out of stock (qty <= 0)."""
    pool = await DataBasePool.get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
                item_id,
                sku,
                name,
                variant_name,
                current_qty
            FROM item_catalog
            WHERE current_qty <= 0
            ORDER BY current_qty ASC, name ASC
            """
        )

    return OutOfStockResponse(
        items=[OutOfStockRow(**dict(row)) for row in rows],
        total=len(rows),
    )


@router.get("/daily-stock", response_model=DailyStockResponse)
async def get_daily_stock(
    target_date: date | None = Query(None, description="Target date (default: today)"),
) -> DailyStockResponse:
    """Get daily stock for a specific date with comparison to previous day."""
    selected_date = target_date or date.today()
    prev_date = selected_date - timedelta(days=1)

    pool = await DataBasePool.get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
                ds.item_id,
                ic.sku,
                ic.name,
                ic.variant_name,
                CAST(ds.qty AS INTEGER) AS qty,
                CAST(prev.qty AS INTEGER) AS prev_qty
            FROM daily_stock ds
            JOIN item_catalog ic ON ds.item_id = ic.item_id
            LEFT JOIN daily_stock prev ON ds.item_id = prev.item_id AND prev.stock_date = $2
            WHERE ds.stock_date = $1
            ORDER BY ic.name ASC
            """,
            selected_date,
            prev_date,
        )

    items = []
    low_stock_count = 0
    for row in rows:
        qty = row["qty"]
        prev_qty = row["prev_qty"]
        change = (qty - prev_qty) if prev_qty is not None else None
        # Count items with low stock (qty <= 10)
        if qty <= 10:
            low_stock_count += 1
        items.append(
            DailyStockRow(
                item_id=row["item_id"],
                sku=row["sku"],
                name=row["name"],
                variant_name=row["variant_name"],
                qty=qty,
                prev_qty=prev_qty,
                change=change,
            )
        )

    return DailyStockResponse(
        items=items,
        total=len(items),
        low_stock_count=low_stock_count,
        stock_date=selected_date,
    )


@router.get("/completed-today", response_model=CompletedTodayResponse)
async def get_completed_today(
    target_date: date | None = Query(None, description="Target date (default: today)"),
) -> CompletedTodayResponse:
    """Get completed transactions for a specific date."""
    selected_date = target_date or date.today()

    pool = await DataBasePool.get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT DISTINCT ON (si.sell_invoice_id)
                si.sell_invoice_id,
                si.invoice_no,
                si.issue_at,
                si.customer_id,
                c.full_name AS customer_name,
                t.name AS treatment_name,
                si.final_amount
            FROM sell_invoice si
            LEFT JOIN customer c ON si.customer_id = c.customer_id
            LEFT JOIN treatment_session ts ON si.sell_invoice_id = ts.sell_invoice_id
            LEFT JOIN treatment t ON ts.treatment_id = t.treatment_id
            WHERE DATE(si.issue_at) = $1 AND si.status = 'PAID'
            ORDER BY si.sell_invoice_id, si.issue_at ASC
            """,
            selected_date,
        )

    items = [CompletedTodayRow(**dict(row)) for row in rows]
    total_amount = sum(item.final_amount or Decimal(0) for item in items)

    return CompletedTodayResponse(
        items=items,
        total_count=len(items),
        total_amount=total_amount,
    )


@router.get("/expiring-items", response_model=ExpiringItemsResponse)
async def get_expiring_items(
    target_date: date | None = Query(None, description="Target date (default: today)"),
    days_ahead: int = Query(90, ge=1, le=365, description="Days ahead to check for expiration"),
    limit: int = Query(20, ge=1, le=50),
) -> ExpiringItemsResponse:
    """Get items that are expiring soon or already expired relative to target_date."""
    selected_date = target_date or date.today()
    future_date = selected_date + timedelta(days=days_ahead)

    pool = await DataBasePool.get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
                pii.item_id,
                ic.sku,
                ic.name,
                ic.variant_name,
                pii.expire_date,
                pii.qty
            FROM purchase_invoice_item pii
            JOIN item_catalog ic ON pii.item_id = ic.item_id
            WHERE pii.expire_date IS NOT NULL
                AND pii.expire_date > $1
                AND pii.expire_date <= $2
            ORDER BY pii.expire_date ASC
            LIMIT $3
            """,
            selected_date,
            future_date,
            limit,
        )

    items = []
    expiring_soon = 0  # within 30 days

    for row in rows:
        expire_date = row["expire_date"]
        days_until = (expire_date - selected_date).days

        if days_until <= 30:
            expiring_soon += 1

        items.append(
            ExpiringItemRow(
                item_id=row["item_id"],
                sku=row["sku"],
                name=row["name"],
                variant_name=row["variant_name"],
                expire_date=expire_date,
                days_until_expire=days_until,
                qty=row["qty"],
            )
        )

    return ExpiringItemsResponse(
        items=items,
        total=len(items),
        expiring_soon=expiring_soon,
        expired=0,
    )
