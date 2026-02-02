from typing import List, Optional

from pydantic import BaseModel


class TreatmentItem(BaseModel):
    treatment_id: int
    name: Optional[str] = None
    category: Optional[str] = None
    price: Optional[int] = None
    description: Optional[str] = None


class TreatmentListResponse(BaseModel):
    treatments: List[TreatmentItem]
    total: int


class TreatmentCategory(BaseModel):
    category: Optional[str] = None
    image_obj_key: Optional[str] = None
    image_url: Optional[str] = None


class TreatmentCategoryListResponse(BaseModel):
    categories: List[TreatmentCategory]
