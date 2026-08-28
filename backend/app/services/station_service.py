import json
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.station import Station
from app.models.event_log import EventLog
from app.services.event_bus import event_bus


def get_stations(db: Session) -> List[Station]:
    return db.query(Station).order_by(Station.id).all()


def get_station(db: Session, station_id: int) -> Optional[Station]:
    return db.query(Station).filter(Station.id == station_id).first()


async def update_station_status(db: Session, station_id: int, is_available: bool) -> Optional[Station]:
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        return None

    prev_status = station.is_available
    station.is_available = is_available
    station.last_updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(station)

    # Log the status change event
    event_type = "station_available" if is_available else "station_unavailable"
    triggered_at = datetime.now(timezone.utc)
    event_log = EventLog(
        event_type=event_type,
        payload=json.dumps({
            "station_id": station.id,
            "name": station.name,
            "is_available": is_available,
            "previous_status": prev_status
        }),
        triggered_at=triggered_at
    )
    db.add(event_log)
    db.commit()

    # Emit through event bus (non-blocking)
    await event_bus.publish(
        "station_status_changed",
        station_id=station_id,
        is_available=is_available,
        event_log_id=event_log.id,
        triggered_at=triggered_at.isoformat()
    )

    return station
