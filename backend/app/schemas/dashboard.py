from pydantic import BaseModel
from datetime import date, datetime
from decimal import Decimal


class StatsCard(BaseModel):
    revenue_today: Decimal
    revenue_yesterday: Decimal
    revenue_change_percent: float | None
    appointments_today: int
    appointments_incomplete: int
    appointments_complete: int
    promotions_used_today: int
    promotions_discount_today: Decimal
    out_of_stock_count: int


class RevenueDataPoint(BaseModel):
    date: date
    amount: Decimal


class RevenueChartResponse(BaseModel):
    data: list[RevenueDataPoint]
    total: Decimal


class AppointmentRow(BaseModel):
    appointment_id: int
    appointment_time: datetime
    customer_id: int | None
    customer_name: str | None
    appointment_status: str


class AppointmentsResponse(BaseModel):
    appointments: list[AppointmentRow]
    total: int
    incomplete: int
    complete: int


class TopTreatmentRow(BaseModel):
    treatment_id: int
    treatment_name: str
    count: int


class TopTreatmentsResponse(BaseModel):
    treatments: list[TopTreatmentRow]


class PromotionUsedRow(BaseModel):
    promotion_id: int
    promotion_code: str | None
    promotion_name: str | None
    usage_count: int
    total_discount: Decimal


class PromotionsUsedResponse(BaseModel):
    promotions: list[PromotionUsedRow]
    total_usage: int
    total_discount: Decimal


class OutOfStockRow(BaseModel):
    item_id: int
    sku: str | None
    name: str | None
    variant_name: str | None
    current_qty: Decimal


class OutOfStockResponse(BaseModel):
    items: list[OutOfStockRow]
    total: int


class DailyStockRow(BaseModel):
    item_id: int
    sku: str | None
    name: str | None
    variant_name: str | None
    qty: int
    prev_qty: int | None
    change: int | None


class DailyStockResponse(BaseModel):
    items: list[DailyStockRow]
    total: int
    low_stock_count: int
    stock_date: date


class CompletedTodayRow(BaseModel):
    sell_invoice_id: int
    invoice_no: str | None
    issue_at: datetime | None
    customer_id: int | None
    customer_name: str | None
    treatment_name: str | None
    final_amount: Decimal | None


class CompletedTodayResponse(BaseModel):
    items: list[CompletedTodayRow]
    total_count: int
    total_amount: Decimal


class ExpiringItemRow(BaseModel):
    item_id: int
    sku: str | None
    name: str | None
    variant_name: str | None
    expire_date: date
    days_until_expire: int
    qty: int | None


class ExpiringItemsResponse(BaseModel):
    items: list[ExpiringItemRow]
    total: int
    expiring_soon: int  # within 30 days
    expired: int  # already expired
