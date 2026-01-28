from typing import List, Optional

from pydantic import BaseModel


class ItemCatalogItem(BaseModel):
    item_id: int
    sku: Optional[str] = None
    name: Optional[str] = None
    variant_name: Optional[str] = None
    item_type: Optional[str] = None
    sell_price: Optional[float] = None
    unit: Optional[str] = None
    current_qty: Optional[float] = None
    status: Optional[str] = None


class ItemCatalogPage(BaseModel):
    items: List[ItemCatalogItem]
    total: int
    page: int
    limit: int
    total_pages: int
