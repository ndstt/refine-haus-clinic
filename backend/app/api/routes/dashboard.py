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
    CompletedTodayRow,
    CompletedTodayResponse,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=StatsCard)
async def get_stats() -> StatsCard:
    """Get dashboard stats cards data."""
    pool = await DataBasePool.get_pool()
    async with pool.acquire() as conn:
        # Revenue today
        revenue_today = await conn.fetchval(
            """
            SELECT COALESCE(SUM(final_amount), 0)
            FROM sell_invoice
            WHERE DATE(issue_at) = CURRENT_DATE AND status = 'PAID'
            """
        )

        # Revenue yesterday (for comparison)
        revenue_yesterday = await conn.fetchval(
            """
            SELECT COALESCE(SUM(final_amount), 0)
            FROM sell_invoice
            WHERE DATE(issue_at) = CURRENT_DATE - INTERVAL '1 day' AND status = 'PAID'
            """
        )

        # Appointments today
        appointments_row = await conn.fetchrow(
            """
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE appointment_status = 'INCOMPLETE') AS incomplete,
                COUNT(*) FILTER (WHERE appointment_status = 'COMPLETE') AS complete
            FROM appointment
            WHERE DATE(appointment_time) = CURRENT_DATE
            """
        )

        # Promotions used today
        promo_row = await conn.fetchrow(
            """
            SELECT
                COUNT(*) AS usage_count,
                COALESCE(SUM(discount_total), 0) AS total_discount
            FROM promotion_redemption
            WHERE DATE(redeemed_at) = CURRENT_DATE
            """
        )

        # Out of stock count
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
) -> RevenueChartResponse:
    """Get revenue chart data for the last N days."""
    pool = await DataBasePool.get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
                DATE(issue_at) AS date,
                COALESCE(SUM(final_amount), 0) AS amount
            FROM sell_invoice
            WHERE DATE(issue_at) >= CURRENT_DATE - $1 * INTERVAL '1 day'
                AND status = 'PAID'
            GROUP BY DATE(issue_at)
            ORDER BY date ASC
            """,
            days,
        )

    # Fill missing dates with 0
    data = []
    total = Decimal(0)
    date_map = {row["date"]: row["amount"] for row in rows}

    for i in range(days, -1, -1):
        d = date.today() - timedelta(days=i)
        amount = date_map.get(d, Decimal(0))
        data.append(RevenueDataPoint(date=d, amount=amount))
        total += amount

    return RevenueChartResponse(data=data, total=total)


@router.get("/appointments", response_model=AppointmentsResponse)
async def get_appointments_today() -> AppointmentsResponse:
    """Get today's appointments."""
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
            WHERE DATE(a.appointment_time) = CURRENT_DATE
            ORDER BY a.appointment_time ASC
            """
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
    limit: int = Query(5, ge=1, le=20),
) -> TopTreatmentsResponse:
    """Get top treatments this month."""
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
            WHERE DATE(ts.session_date) >= DATE_TRUNC('month', CURRENT_DATE)
            GROUP BY ts.treatment_id, t.name
            ORDER BY count DESC
            LIMIT $1
            """,
            limit,
        )

    return TopTreatmentsResponse(
        treatments=[TopTreatmentRow(**dict(row)) for row in rows]
    )


@router.get("/promotions-used", response_model=PromotionsUsedResponse)
async def get_promotions_used(
    limit: int = Query(5, ge=1, le=20),
) -> PromotionsUsedResponse:
    """Get recently used promotions."""
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
            WHERE DATE(pr.redeemed_at) >= DATE_TRUNC('month', CURRENT_DATE)
            GROUP BY pr.promotion_id, p.code, p.name
            ORDER BY usage_count DESC
            LIMIT $1
            """,
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


@router.get("/completed-today", response_model=CompletedTodayResponse)
async def get_completed_today() -> CompletedTodayResponse:
    """Get completed transactions today."""
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
            WHERE DATE(si.issue_at) = CURRENT_DATE AND si.status = 'PAID'
            ORDER BY si.sell_invoice_id, si.issue_at ASC
            """
        )

    items = [CompletedTodayRow(**dict(row)) for row in rows]
    total_amount = sum(item.final_amount or Decimal(0) for item in items)

    return CompletedTodayResponse(
        items=items,
        total_count=len(items),
        total_amount=total_amount,
    )
