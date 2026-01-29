from typing import Optional

from pydantic import BaseModel


class BookingRequest(BaseModel):
    treatment_id: int
    customer_name: str
    customer_id: Optional[str] = None
    session_date: str
    session_time: str
    note: Optional[str] = None
    amount: int


class BookingResponse(BaseModel):
    success: bool
    invoice_no: Optional[str] = None
    sell_invoice_id: Optional[int] = None
    message: Optional[str] = None
