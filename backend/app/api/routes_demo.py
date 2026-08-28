from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.init_db import seed_demo_data, generate_random_scenario
from app.models.event_log import EventLog
from app.mock.swap_station_simulator import station_simulator

router = APIRouter(prefix="/demo", tags=["Demo"])


@router.post("/reset")
def reset_demo_endpoint(db: Session = Depends(get_db)):
    seed_demo_data(db)
    return {"message": "Demo data reset successfully", "status": "success"}


@router.post("/randomize")
def randomize_demo_endpoint(num_orders: int = 6, db: Session = Depends(get_db)):
    result = generate_random_scenario(db, num_orders=num_orders)
    return result


@router.get("/status")
def get_demo_status_endpoint(db: Session = Depends(get_db)):
    logs = db.query(EventLog).order_by(EventLog.id.desc()).limit(10).all()
    logs_data = [
        {
            "id": l.id,
            "event_type": l.event_type,
            "payload": l.payload,
            "triggered_at": l.triggered_at.isoformat() if l.triggered_at else None,
            "resolved_at": l.resolved_at.isoformat() if l.resolved_at else None
        }
        for l in logs
    ]
    return {
        "simulator_running": station_simulator.is_running,
        "recent_events": logs_data
    }


@router.post("/simulator/toggle")
def toggle_simulator_endpoint(enable: bool = True):
    if enable:
        station_simulator.start()
    else:
        station_simulator.stop()
    return {
        "simulator_running": station_simulator.is_running,
        "message": f"Simulator {'started' if station_simulator.is_running else 'stopped'}"
    }
