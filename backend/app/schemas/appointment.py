from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class AppointmentRow(BaseModel):
    appointment_id: int
    customer_id: Optional[int] = None
    customer_code: Optional[str] = None
    full_name: Optional[str] = None
    appointment_time: Optional[datetime] = None
    appointment_status: Optional[str] = None


class AppointmentListResponse(BaseModel):
    items: List[AppointmentRow]


class AppointmentStatusUpdate(BaseModel):
    appointment_status: str


class AppointmentCreateRequest(BaseModel):
    customer_id: int
    appointment_time: datetime
    appointment_status: Optional[str] = None
