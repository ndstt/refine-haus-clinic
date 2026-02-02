from datetime import date
from typing import List, Optional

from pydantic import BaseModel


class CustomerOption(BaseModel):
    customer_id: int
    customer_code: Optional[str] = None
    full_name: Optional[str] = None
    nickname: Optional[str] = None


class CustomerCreateRequest(BaseModel):
    full_name: str
    nickname: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None


class CustomerRow(BaseModel):
    customer_id: int
    customer_code: Optional[str] = None
    full_name: Optional[str] = None
    nickname: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    member_wallet_remain: Optional[float] = None


class CustomerSearchResponse(BaseModel):
    customers: List[CustomerOption]


class CustomerListResponse(BaseModel):
    items: List[CustomerRow]


class CustomerTreatmentRow(BaseModel):
    treatment_id: int
    treatment_name: Optional[str] = None
    image_obj_key: Optional[str] = None
    image_url: Optional[str] = None
    session_date: Optional[date] = None
    session_time: Optional[str] = None
    age_at_session: Optional[int] = None
    note: Optional[str] = None
    sell_invoice_id: Optional[int] = None


class CustomerTreatmentResponse(BaseModel):
    customer: CustomerRow
    treatments: List[CustomerTreatmentRow]
