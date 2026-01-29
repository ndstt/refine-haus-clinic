from datetime import date
from typing import List, Optional

from pydantic import BaseModel


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


class CustomerListResponse(BaseModel):
    items: List[CustomerRow]
