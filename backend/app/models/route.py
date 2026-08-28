from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, String, DateTime
from sqlalchemy.orm import relationship
from app.db.database import Base


class Route(Base):
    __tablename__ = "routes"

    id = Column(Integer, primary_key=True, index=True)
    shipper_id = Column(Integer, default=1, index=True)
    total_cost = Column(Float, default=0.0)
    status = Column(String, default="active")  # active / completed
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    stops = relationship("RouteStop", back_populates="route", cascade="all, delete-orphan", order_by="RouteStop.sequence_index")
