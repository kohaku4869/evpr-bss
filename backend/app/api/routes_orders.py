from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.order_schema import OrderCreate, OrderOut
from app.services.order_service import get_orders, create_order, get_order
from app.services.route_service import handle_new_order_event

router = APIRouter(prefix="/orders", tags=["Orders"])


@router.post("/inject")
async def inject_live_order_endpoint(shipper_id: int = 1):
    """
    Reactive demo trigger: generates a random pickup/delivery order and inserts
    it live into the shipper's active route mutable suffix, pushing a
    route_patched WebSocket event — demonstrates the reactive layer handling new
    demand mid-drive (de_bai.md section 4), not just station-down events.
    """
    result = await handle_new_order_event(shipper_id=shipper_id)
    if not result.get("success"):
        raise HTTPException(status_code=409, detail=result.get("reason", "Could not insert order into active route"))
    return result


@router.get("", response_model=List[OrderOut])
def list_orders_endpoint(db: Session = Depends(get_db)):
    return get_orders(db)


@router.post("", response_model=OrderOut, status_code=201)
def create_order_endpoint(order_in: OrderCreate, db: Session = Depends(get_db)):
    return create_order(db, order_in)


@router.get("/{order_id}", response_model=OrderOut)
def get_order_endpoint(order_id: int, db: Session = Depends(get_db)):
    order = get_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order
