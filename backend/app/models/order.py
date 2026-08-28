from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, String, DateTime
from sqlalchemy.orm import relationship
from app.db.database import Base


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    pickup_lat = Column(Float, nullable=False)
    pickup_lng = Column(Float, nullable=False)
    delivery_lat = Column(Float, nullable=False)
    delivery_lng = Column(Float, nullable=False)
    weight = Column(Float, nullable=False, default=1.0)
    status = Column(String, default="pending")  # pending / assigned / picked_up / delivered
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    route_stops = relationship("RouteStop", back_populates="order")
