import os
import sys
import random
from typing import Optional, Dict, Any, List

# Ensure backend dir is on path
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sqlalchemy.orm import Session
from app.db.database import Base, engine, SessionLocal
from app.models.order import Order
from app.models.station import Station
from app.models.route import Route
from app.models.route_stop import RouteStop
from app.models.event_log import EventLog
from app.models.routing_cache import RoutingCache
from app.config import settings

# Curated list of 30 realistic Hanoi Battery Swap Stations
HANOI_STATIONS_DATA = [
    {"id": 1, "name": "BSS Hoan Kiem - Trang Tien", "lat": 21.0250, "lng": 105.8570, "cost_swap": 5.0},
    {"id": 2, "name": "BSS Hoan Kiem - Hang Dau", "lat": 21.0405, "lng": 105.8480, "cost_swap": 5.0},
    {"id": 3, "name": "BSS Hoan Kiem - Ly Thuong Kiet", "lat": 21.0220, "lng": 105.8510, "cost_swap": 5.0},
    {"id": 4, "name": "BSS Ba Dinh - Kim Ma", "lat": 21.0310, "lng": 105.8230, "cost_swap": 5.0},
    {"id": 5, "name": "BSS Ba Dinh - Doi Can", "lat": 21.0380, "lng": 105.8180, "cost_swap": 5.0},
    {"id": 6, "name": "BSS Ba Dinh - Quan Thanh", "lat": 21.0430, "lng": 105.8410, "cost_swap": 5.0},
    {"id": 7, "name": "BSS Dong Da - Xa Dan", "lat": 21.0140, "lng": 105.8340, "cost_swap": 5.0},
    {"id": 8, "name": "BSS Dong Da - Chua Boc", "lat": 21.0080, "lng": 105.8280, "cost_swap": 5.0},
    {"id": 9, "name": "BSS Dong Da - Lang Ha", "lat": 21.0175, "lng": 105.8150, "cost_swap": 5.0},
    {"id": 10, "name": "BSS Dong Da - Ton Duc Thang", "lat": 21.0230, "lng": 105.8320, "cost_swap": 5.0},
    {"id": 11, "name": "BSS Cau Giay - Dich Vong", "lat": 21.0365, "lng": 105.7909, "cost_swap": 5.0},
    {"id": 12, "name": "BSS Cau Giay - Trung Kinh", "lat": 21.0180, "lng": 105.7980, "cost_swap": 5.0},
    {"id": 13, "name": "BSS Cau Giay - Duy Tan", "lat": 21.0310, "lng": 105.7830, "cost_swap": 5.0},
    {"id": 14, "name": "BSS Cau Giay - Cau Giay Street", "lat": 21.0340, "lng": 105.8010, "cost_swap": 5.0},
    {"id": 15, "name": "BSS Tay Ho - Lac Long Quan", "lat": 21.0598, "lng": 105.8175, "cost_swap": 5.0},
    {"id": 16, "name": "BSS Tay Ho - Au Co", "lat": 21.0650, "lng": 105.8320, "cost_swap": 5.0},
    {"id": 17, "name": "BSS Tay Ho - Xuan La", "lat": 21.0600, "lng": 105.8020, "cost_swap": 5.0},
    {"id": 18, "name": "BSS Hai Ba Trung - Bach Mai", "lat": 21.0007, "lng": 105.8505, "cost_swap": 5.0},
    {"id": 19, "name": "BSS Hai Ba Trung - Minh Khai", "lat": 20.9980, "lng": 105.8650, "cost_swap": 5.0},
    {"id": 20, "name": "BSS Hai Ba Trung - Times City", "lat": 20.9950, "lng": 105.8680, "cost_swap": 5.0},
    {"id": 21, "name": "BSS Thanh Xuan - Nguyen Trai", "lat": 20.9954, "lng": 105.8072, "cost_swap": 6.0},
    {"id": 22, "name": "BSS Thanh Xuan - Le Van Luong", "lat": 21.0060, "lng": 105.8050, "cost_swap": 5.0},
    {"id": 23, "name": "BSS Thanh Xuan - Khuat Duy Tien", "lat": 20.9980, "lng": 105.7930, "cost_swap": 5.0},
    {"id": 24, "name": "BSS Hoang Mai - Linh Dam", "lat": 20.9670, "lng": 105.8310, "cost_swap": 5.0},
    {"id": 25, "name": "BSS Hoang Mai - Giai Phong", "lat": 20.9880, "lng": 105.8420, "cost_swap": 5.0},
    {"id": 26, "name": "BSS Long Bien - Nguyen Van Cu", "lat": 21.0432, "lng": 105.8837, "cost_swap": 5.0},
    {"id": 27, "name": "BSS Long Bien - Aeon Mall", "lat": 21.0260, "lng": 105.9000, "cost_swap": 5.0},
    {"id": 28, "name": "BSS Nam Tu Liem - My Dinh", "lat": 21.0280, "lng": 105.7720, "cost_swap": 5.0},
    {"id": 29, "name": "BSS Nam Tu Liem - Le Duc Tho", "lat": 21.0350, "lng": 105.7680, "cost_swap": 5.0},
    {"id": 30, "name": "BSS Ha Dong - Tran Phu", "lat": 20.9820, "lng": 105.7880, "cost_swap": 5.0},
]

# Candidate central hubs in Hanoi
HANOI_DEPOT_CANDIDATES = [
    {"name": "Depot Hoan Kiem Hub", "lat": 21.0285, "lng": 105.8542},
    {"name": "Depot Dong Da Central", "lat": 21.0180, "lng": 105.8260},
    {"name": "Depot Cau Giay Logistics", "lat": 21.0300, "lng": 105.7950},
    {"name": "Depot Hai Ba Trung Logistics", "lat": 21.0050, "lng": 105.8520},
    {"name": "Depot Ba Dinh Hub", "lat": 21.0340, "lng": 105.8200},
]

# Seed orders
INITIAL_ORDERS = [
    {"id": 1, "pickup_lat": 21.0315, "pickup_lng": 105.8526, "delivery_lat": 21.0368, "delivery_lng": 105.8342, "weight": 8.0},
    {"id": 2, "pickup_lat": 21.0278, "pickup_lng": 105.8355, "delivery_lat": 21.0361, "delivery_lng": 105.7829, "weight": 12.0},
    {"id": 3, "pickup_lat": 21.0379, "pickup_lng": 105.7827, "delivery_lat": 21.0011, "delivery_lng": 105.8203, "weight": 10.0},
    {"id": 4, "pickup_lat": 20.9984, "pickup_lng": 105.8200, "delivery_lat": 21.0027, "delivery_lng": 105.8558, "weight": 15.0},
    {"id": 5, "pickup_lat": 21.0024, "pickup_lng": 105.8563, "delivery_lat": 21.0430, "delivery_lng": 105.8795, "weight": 7.0},
    {"id": 6, "pickup_lat": 21.0443, "pickup_lng": 105.8791, "delivery_lat": 21.0584, "delivery_lng": 105.8187, "weight": 9.0},
]


def init_database():
    Base.metadata.create_all(bind=engine)


def seed_demo_data(db: Session):
    # Clear existing active routes and orders
    db.query(RouteStop).delete()
    db.query(Route).delete()
    db.query(EventLog).delete()
    db.query(Order).delete()
    db.query(Station).delete()
    db.commit()

    # Create 30 Hanoi Stations
    for st_data in HANOI_STATIONS_DATA:
        station = Station(
            id=st_data["id"],
            name=st_data["name"],
            lat=st_data["lat"],
            lng=st_data["lng"],
            is_available=True,
            cost_swap=st_data["cost_swap"]
        )
        db.add(station)

    # Create initial Hanoi demo orders
    for ord_data in INITIAL_ORDERS:
        order = Order(
            id=ord_data["id"],
            pickup_lat=ord_data["pickup_lat"],
            pickup_lng=ord_data["pickup_lng"],
            delivery_lat=ord_data["delivery_lat"],
            delivery_lng=ord_data["delivery_lng"],
            weight=ord_data["weight"],
            status="pending"
        )
        db.add(order)

    # Set default depot
    settings.DEPOT_LAT = 21.0285
    settings.DEPOT_LNG = 105.8542

    db.commit()


def random_order_coords() -> Dict[str, float]:
    """
    Generates one random pickup/delivery pair inside the Hanoi inner urban zone
    (lat 20.990-21.060, lng 105.770-105.880), the same bounding box used to seed
    randomized demo scenarios. Shared by generate_random_scenario() and the
    reactive "new order mid-drive" demo trigger (route_service.handle_new_order_event).
    """
    p_lat = round(random.uniform(20.995, 21.055), 4)
    p_lng = round(random.uniform(105.780, 105.875), 4)

    # Delivery within reasonable distance (offset 0.012 - 0.035 deg ~ 1.2 - 3.5km)
    d_lat_offset = random.choice([-1, 1]) * random.uniform(0.012, 0.035)
    d_lng_offset = random.choice([-1, 1]) * random.uniform(0.012, 0.035)
    d_lat = round(min(max(p_lat + d_lat_offset, 20.990), 21.065), 4)
    d_lng = round(min(max(p_lng + d_lng_offset, 105.770), 105.890), 4)

    weight = round(random.uniform(5.0, 16.0), 1)

    return {
        "pickup_lat": p_lat,
        "pickup_lng": p_lng,
        "delivery_lat": d_lat,
        "delivery_lng": d_lng,
        "weight": weight,
    }


def generate_random_scenario(db: Session, num_orders: int = 6) -> Dict[str, Any]:
    """Generates a randomized scenario with a random Depot and random Hanoi orders."""
    # 1. Clear current route and orders
    db.query(RouteStop).delete()
    db.query(Route).delete()
    db.query(Order).delete()
    db.commit()

    # Ensure stations exist
    if db.query(Station).count() == 0:
        for st_data in HANOI_STATIONS_DATA:
            station = Station(
                id=st_data["id"],
                name=st_data["name"],
                lat=st_data["lat"],
                lng=st_data["lng"],
                is_available=True,
                cost_swap=st_data["cost_swap"]
            )
            db.add(station)
        db.commit()
    else:
        # Reset all stations to available
        db.query(Station).update({"is_available": True})
        db.commit()

    # 2. Pick a random Depot from candidates or random center location
    chosen_depot = random.choice(HANOI_DEPOT_CANDIDATES)
    settings.DEPOT_LAT = chosen_depot["lat"]
    settings.DEPOT_LNG = chosen_depot["lng"]

    # 3. Generate randomized orders in Hanoi inner urban zone
    # Hanoi bounding box: Lat 20.990 - 21.060, Lng 105.770 - 105.880
    orders_created = []
    for i in range(1, num_orders + 1):
        coords = random_order_coords()

        order = Order(
            id=i,
            pickup_lat=coords["pickup_lat"],
            pickup_lng=coords["pickup_lng"],
            delivery_lat=coords["delivery_lat"],
            delivery_lng=coords["delivery_lng"],
            weight=coords["weight"],
            status="pending"
        )
        db.add(order)
        orders_created.append({
            "id": i,
            "pickup": [coords["pickup_lat"], coords["pickup_lng"]],
            "delivery": [coords["delivery_lat"], coords["delivery_lng"]],
            "weight": coords["weight"]
        })

    db.commit()

    return {
        "status": "success",
        "depot": {"name": chosen_depot["name"], "lat": settings.DEPOT_LAT, "lng": settings.DEPOT_LNG},
        "num_orders": len(orders_created),
        "orders": orders_created,
    }


if __name__ == "__main__":
    init_database()
    with SessionLocal() as session:
        seed_demo_data(session)
    print("Database initialized and 30 Hanoi demo stations seeded successfully.")
