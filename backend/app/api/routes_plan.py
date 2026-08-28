from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.route_schema import OptimizeRequest, RouteOut
from app.services.route_service import optimize_plan

router = APIRouter(prefix="/plan", tags=["Plan"])


@router.post("/optimize", response_model=RouteOut)
def optimize_route_endpoint(
    req: OptimizeRequest = OptimizeRequest(),
    db: Session = Depends(get_db)
):
    return optimize_plan(db, shipper_id=req.shipper_id)
