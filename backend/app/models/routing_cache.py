from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, UniqueConstraint
from app.db.database import Base


class RoutingCache(Base):
    __tablename__ = "routing_cache"
    __table_args__ = (
        UniqueConstraint("cache_key", name="uq_routing_cache_key"),
    )

    id = Column(Integer, primary_key=True, index=True)
    cache_key = Column(String, nullable=False, index=True)
    provider = Column(String, nullable=False, default="fallback")
    origin_lat = Column(Float, nullable=False)
    origin_lng = Column(Float, nullable=False)
    dest_lat = Column(Float, nullable=False)
    dest_lng = Column(Float, nullable=False)
    distance_km = Column(Float, nullable=False)
    duration_seconds = Column(Float, nullable=False)
    geometry_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
