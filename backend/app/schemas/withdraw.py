from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class WithdrawItemRequest(BaseModel):
    item_id: Optional[int] = None
    item_code: Optional[str] = None
    item_name: Optional[str] = None
    item_variant: Optional[str] = None
    item_type: Optional[str] = None
    unit: Optional[str] = None
    qty: float
    expire_date: Optional[datetime] = None


class WithdrawBatchRequest(BaseModel):
    created_at: Optional[datetime] = None
    movement_type: Optional[str] = None
    note: Optional[str] = None
    items: List[WithdrawItemRequest]


class WithdrawBatchResponse(BaseModel):
    inserted: int


class WithdrawHistoryRow(BaseModel):
    created_at: Optional[datetime] = None
    movement_type: Optional[str] = None
    item_code: Optional[str] = None
    item_name: Optional[str] = None
    item_variant: Optional[str] = None
    qty: Optional[float] = None
    unit: Optional[str] = None


class WithdrawHistoryResponse(BaseModel):
    items: List[WithdrawHistoryRow]
