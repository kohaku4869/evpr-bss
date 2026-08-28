from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.route_schema import RouteOut
from app.services.route_service import get_active_route, complete_stop

router = APIRouter(prefix="/routes", tags=["Tracking"])


@router.get("/{shipper_id}/current", response_model=RouteOut)
def get_current_route_endpoint(shipper_id: int, db: Session = Depends(get_db)):
    route = get_active_route(db, shipper_id)
    if not route:
        raise HTTPException(status_code=404, detail="No active route found for this shipper")
    return route


@router.post("/{route_id}/stop/{stop_id}/complete", response_model=RouteOut)
def complete_stop_endpoint(route_id: int, stop_id: int, db: Session = Depends(get_db)):
    updated_route = complete_stop(db, route_id, stop_id)
    if not updated_route:
        raise HTTPException(status_code=404, detail="Route or Stop not found")
    return updated_route
