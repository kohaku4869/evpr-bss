from datetime import datetime
from pydantic import BaseModel, ConfigDict
from typing import Optional


class StationBase(BaseModel):
    name: str
    lat: float
    lng: float
    is_available: bool = True
    cost_swap: float = 5.0


class StationCreate(StationBase):
    pass


class StationStatusUpdate(BaseModel):
    is_available: bool


class StationOut(StationBase):
    id: int
    last_updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
