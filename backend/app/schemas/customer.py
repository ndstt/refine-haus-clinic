from typing import List, Optional

from pydantic import BaseModel


class CustomerOption(BaseModel):
    customer_id: int
    customer_code: Optional[str] = None
    full_name: Optional[str] = None
    nickname: Optional[str] = None


class CustomerSearchResponse(BaseModel):
    customers: List[CustomerOption]
