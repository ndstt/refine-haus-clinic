from typing import Optional, List

from pydantic import BaseModel


class TreatmentItem(BaseModel):
    treatment_id: int
    price: int
    quantity: int = 1


class BookingRequest(BaseModel):
    treatments: List[TreatmentItem]
    customer_name: str
    customer_id: Optional[str] = None
    promotions: List[int] = []
    session_date: str
    session_time: str
    note: Optional[str] = None
    total_amount: int


class BookingResponse(BaseModel):
    success: bool
    invoice_no: Optional[str] = None
    sell_invoice_id: Optional[int] = None
    message: Optional[str] = None
