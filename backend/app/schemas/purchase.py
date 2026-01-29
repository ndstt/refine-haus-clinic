from datetime import datetime, date
from typing import List, Optional

from pydantic import BaseModel


class PurchaseInvoiceDraftRequest(BaseModel):
    supplier_id: Optional[int] = None
    supplier_name: Optional[str] = None
    issue_at: Optional[datetime] = None


class PurchaseInvoiceDraftResponse(BaseModel):
    purchase_invoice_id: int
    purchase_no: Optional[str] = None


class PurchaseInvoiceHeader(BaseModel):
    purchase_invoice_id: int
    purchase_no: Optional[str] = None
    supplier_id: Optional[int] = None
    supplier_name: Optional[str] = None
    issue_at: Optional[datetime] = None


class PurchaseInvoiceItemRequest(BaseModel):
    item_code: Optional[str] = None
    item_name: Optional[str] = None
    item_variant: Optional[str] = None
    item_type: Optional[str] = None
    qty: float
    unit: Optional[str] = None
    purchase_price_per_unit: float
    expire_date: Optional[date] = None


class PurchaseInvoiceItemResponse(BaseModel):
    purchase_invoice_item_id: int
    purchase_invoice_id: int
    item_id: int
    item_code: Optional[str] = None
    item_name: Optional[str] = None
    item_variant: Optional[str] = None
    item_type: Optional[str] = None
    qty: float
    unit: Optional[str] = None
    purchase_price_per_unit: Optional[float] = None
    expire_date: Optional[date] = None


class PurchaseInvoiceItemsResponse(BaseModel):
    items: List[PurchaseInvoiceItemResponse]


class PurchaseInvoiceDetailResponse(BaseModel):
    header: PurchaseInvoiceHeader
    items: List[PurchaseInvoiceItemResponse]


class SupplierOption(BaseModel):
    supplier_id: int
    name: str


class SupplierOptionResponse(BaseModel):
    suppliers: List[SupplierOption]


class ImportItemRow(BaseModel):
    created_at: Optional[datetime] = None
    supplier_name: Optional[str] = None
    item_code: Optional[str] = None
    item_name: Optional[str] = None
    item_variant: Optional[str] = None
    item_type: Optional[str] = None
    qty: Optional[float] = None
    purchase_price_per_unit: Optional[float] = None
    expire_date: Optional[date] = None


class ImportItemsResponse(BaseModel):
    items: List[ImportItemRow]
