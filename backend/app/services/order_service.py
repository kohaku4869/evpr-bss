from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.order import Order
from app.schemas.order_schema import OrderCreate


def get_orders(db: Session) -> List[Order]:
    return db.query(Order).order_by(Order.id).all()


def get_order(db: Session, order_id: int) -> Optional[Order]:
    return db.query(Order).filter(Order.id == order_id).first()


def create_order(db: Session, order_in: OrderCreate) -> Order:
    order = Order(
        pickup_lat=order_in.pickup_lat,
        pickup_lng=order_in.pickup_lng,
        delivery_lat=order_in.delivery_lat,
        delivery_lng=order_in.delivery_lng,
        weight=order_in.weight,
        status="pending"
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order
