from datetime import datetime
from pydantic import BaseModel, ConfigDict
from typing import Optional


class OrderBase(BaseModel):
    pickup_lat: float
    pickup_lng: float
    delivery_lat: float
    delivery_lng: float
    weight: float = 1.0


class OrderCreate(OrderBase):
    pass


class OrderOut(OrderBase):
    id: int
    status: str
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
