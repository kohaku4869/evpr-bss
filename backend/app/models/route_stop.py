from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.database import Base


class RouteStop(Base):
    __tablename__ = "route_stops"

    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=False)
    sequence_index = Column(Integer, nullable=False)
    stop_type = Column(String, nullable=False)  # 'depot' / 'pickup' / 'delivery' / 'swap_station'
    ref_order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    ref_station_id = Column(Integer, ForeignKey("stations.id"), nullable=True)
    status = Column(String, default="pending")  # 'pending' / 'done'
    eta = Column(DateTime, nullable=True)

    route = relationship("Route", back_populates="stops")
    order = relationship("Order", back_populates="route_stops")
    station = relationship("Station", back_populates="route_stops")
