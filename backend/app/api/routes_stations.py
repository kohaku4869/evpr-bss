from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.station_schema import StationOut, StationStatusUpdate
from app.services.station_service import get_stations, get_station, update_station_status

router = APIRouter(prefix="/stations", tags=["Stations"])


@router.get("", response_model=List[StationOut])
def list_stations_endpoint(db: Session = Depends(get_db)):
    return get_stations(db)


@router.get("/{station_id}", response_model=StationOut)
def get_station_endpoint(station_id: int, db: Session = Depends(get_db)):
    station = get_station(db, station_id)
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    return station


@router.patch("/{station_id}/status", response_model=StationOut)
async def update_station_status_endpoint(
    station_id: int,
    status_update: StationStatusUpdate,
    db: Session = Depends(get_db)
):
    station = await update_station_status(db, station_id, status_update.is_available)
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    return station
