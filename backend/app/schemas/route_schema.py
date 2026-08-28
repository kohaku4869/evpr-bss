from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List, Any, Dict


class RouteStopOut(BaseModel):
    id: Optional[int] = None
    sequence_index: int
    stop_type: str  # 'depot' / 'pickup' / 'delivery' / 'swap_station'
    ref_order_id: Optional[int] = None
    ref_station_id: Optional[int] = None
    status: str = "pending"  # 'pending' / 'done'
    eta: Optional[datetime] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    label: Optional[str] = None
    weight: Optional[float] = None
    current_load: Optional[float] = None
    arriving_battery: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class RouteSegmentOut(BaseModel):
    from_sequence_index: int
    to_sequence_index: int
    distance_km: float
    duration_seconds: float
    geometry_source: str
    geometry: Dict[str, Any]


class RouteOut(BaseModel):
    id: int
    shipper_id: int
    total_cost: float
    total_distance_km: float = 0.0
    total_duration_seconds: float = 0.0
    geometry_source: str = "none"
    matrix_source: str = "none"
    battery_capacity_kwh: float = 0.0
    geometry: Dict[str, Any] = Field(default_factory=lambda: {"type": "FeatureCollection", "features": []})
    segments: List[RouteSegmentOut] = Field(default_factory=list)
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    stops: List[RouteStopOut] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class OptimizeRequest(BaseModel):
    shipper_id: int = 1


class RoutePatchEvent(BaseModel):
    event: str  # 'route_patched' | 'route_patch_failed' | 'station_status_changed'
    reason: Optional[str] = None
    old_stop: Optional[dict[str, Any]] = None
    new_stop: Optional[dict[str, Any]] = None
    updated_stops: List[RouteStopOut] = Field(default_factory=list)
    geometry: Optional[Dict[str, Any]] = None
    segments: List[RouteSegmentOut] = Field(default_factory=list)
    total_cost: Optional[float] = None
    total_distance_km: Optional[float] = None
    total_duration_seconds: Optional[float] = None
    matrix_source: Optional[str] = None
    latency_ms: Optional[float] = None
    timestamp: str
