from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime
from app.db.database import Base


class EventLog(Base):
    __tablename__ = "events_log"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String, nullable=False)  # 'station_unavailable', 'route_patched', 'route_patch_failed', etc.
    payload = Column(Text, nullable=True)        # JSON string
    triggered_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    resolved_at = Column(DateTime, nullable=True)
