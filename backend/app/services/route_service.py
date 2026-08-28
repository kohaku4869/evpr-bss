import json
import time
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.db.init_db import random_order_coords
from app.models.route import Route
from app.models.route_stop import RouteStop
from app.models.order import Order
from app.models.station import Station
from app.models.event_log import EventLog
from app.schemas.route_schema import RouteOut, RouteStopOut, RoutePatchEvent
from app.schemas.order_schema import OrderCreate
from app.core.feasibility import Stop, check_feasibility_and_cost
from app.core import cost as cost_module
from app.core.alns.alns_runner import ALNSRunner
from app.core.alns.repair_operators import evaluate_order_insertion_positions
from app.core.reactive.local_patch import apply_local_patch
from app.services.event_bus import event_bus
from app.services.order_service import create_order
from app.services.routing_service import build_route_segments, build_and_warm_distance_matrix
from app.config import settings


def enrich_route_stops(stops_db: List[RouteStop], orders_map: Dict[int, Order], stations_map: Dict[int, Station]) -> List[RouteStopOut]:
    """Converts DB route stops to enriched RouteStopOut schema with coordinates and metrics."""
    core_stops: List[Stop] = []
    out_stops: List[RouteStopOut] = []

    for s in stops_db:
        lat, lng, weight, label = settings.DEPOT_LAT, settings.DEPOT_LNG, 0.0, "Depot"
        if s.stop_type == "pickup" and s.ref_order_id in orders_map:
            ord_obj = orders_map[s.ref_order_id]
            lat, lng = ord_obj.pickup_lat, ord_obj.pickup_lng
            weight = ord_obj.weight
            label = f"Pickup #{s.ref_order_id}"
        elif s.stop_type == "delivery" and s.ref_order_id in orders_map:
            ord_obj = orders_map[s.ref_order_id]
            lat, lng = ord_obj.delivery_lat, ord_obj.delivery_lng
            weight = ord_obj.weight
            label = f"Delivery #{s.ref_order_id}"
        elif s.stop_type == "swap_station" and s.ref_station_id in stations_map:
            st_obj = stations_map[s.ref_station_id]
            lat, lng = st_obj.lat, st_obj.lng
            label = st_obj.name

        core_stop = Stop(
            stop_type=s.stop_type,
            lat=lat,
            lng=lng,
            ref_order_id=s.ref_order_id,
            ref_station_id=s.ref_station_id,
            weight=weight,
            status=s.status,
            label=label
        )
        core_stops.append(core_stop)

    # Evaluate states along the route
    eval_res = check_feasibility_and_cost(
        core_stops,
        stations_map=stations_map,
        capacity=settings.VEHICLE_CAPACITY_Q,
        battery_max=settings.BATTERY_CAPACITY_B,
        base_rate=settings.BASE_CONSUMPTION_RATE,
        load_factor=settings.LOAD_CONSUMPTION_FACTOR
    )

    for i, s in enumerate(stops_db):
        core_s = core_stops[i]
        load = eval_res.step_loads[i] if eval_res.step_loads and i < len(eval_res.step_loads) else 0.0
        bat = eval_res.step_batteries[i] if eval_res.step_batteries and i < len(eval_res.step_batteries) else settings.BATTERY_CAPACITY_B

        out_stops.append(
            RouteStopOut(
                id=s.id,
                sequence_index=s.sequence_index,
                stop_type=s.stop_type,
                ref_order_id=s.ref_order_id,
                ref_station_id=s.ref_station_id,
                status=s.status,
                eta=s.eta,
                lat=core_s.lat,
                lng=core_s.lng,
                label=core_s.label,
                weight=core_s.weight,
                current_load=round(load, 2),
                arriving_battery=round(bat, 2)
            )
        )

    return out_stops


def get_active_route(db: Session, shipper_id: int = 1) -> Optional[RouteOut]:
    route = db.query(Route).filter(Route.shipper_id == shipper_id, Route.status == "active").order_by(Route.id.desc()).first()
    if not route:
        return None

    orders_map = {o.id: o for o in db.query(Order).all()}
    stations_map = {s.id: s for s in db.query(Station).all()}

    enriched_stops = enrich_route_stops(route.stops, orders_map, stations_map)
    route_geo = build_route_segments(db, enriched_stops)
    db.commit()

    return RouteOut(
        id=route.id,
        shipper_id=route.shipper_id,
        total_cost=round(route.total_cost, 2),
        total_distance_km=route_geo["total_distance_km"],
        total_duration_seconds=route_geo["total_duration_seconds"],
        geometry_source=route_geo["geometry_source"],
        matrix_source=cost_module.get_distance_matrix_meta()["source"],
        battery_capacity_kwh=settings.BATTERY_CAPACITY_B,
        geometry=route_geo["geometry"],
        segments=route_geo["segments"],
        status=route.status,
        created_at=route.created_at,
        updated_at=route.updated_at,
        stops=enriched_stops
    )


def optimize_plan(db: Session, shipper_id: int = 1) -> RouteOut:
    orders = db.query(Order).filter(Order.status.in_(["pending", "assigned"])).all()
    stations = db.query(Station).all()

    # Fetch real road distances between every depot/order/station point BEFORE
    # running ALNS, so sequencing, battery feasibility, and BSS insertion cost are
    # all decided on real road km instead of straight-line distance.
    points = [(settings.DEPOT_LAT, settings.DEPOT_LNG)]
    for o in orders:
        points.append((o.pickup_lat, o.pickup_lng))
        points.append((o.delivery_lat, o.delivery_lng))
    for s in stations:
        points.append((s.lat, s.lng))
    build_and_warm_distance_matrix(points)

    runner = ALNSRunner(
        orders=orders,
        stations=stations,
        depot_lat=settings.DEPOT_LAT,
        depot_lng=settings.DEPOT_LNG,
        random_seed=settings.ALNS_RANDOM_SEED
    )

    best_sol = runner.run(
        max_iterations=settings.ALNS_MAX_ITERATIONS,
        time_limit_seconds=settings.ALNS_TIME_LIMIT_SECONDS
    )

    # Deactivate prior active routes
    db.query(Route).filter(Route.shipper_id == shipper_id, Route.status == "active").update({"status": "completed"})

    # Create new route
    new_route = Route(
        shipper_id=shipper_id,
        total_cost=best_sol.cost,
        status="active"
    )
    db.add(new_route)
    db.flush()

    for idx, stop in enumerate(best_sol.stops):
        stop_status = "done" if stop.stop_type == "depot" else "pending"
        route_stop = RouteStop(
            route_id=new_route.id,
            sequence_index=idx,
            stop_type=stop.stop_type,
            ref_order_id=stop.ref_order_id,
            ref_station_id=stop.ref_station_id,
            status=stop_status
        )
        db.add(route_stop)

    # Update order statuses
    for ord_obj in orders:
        if ord_obj.id in best_sol.get_served_orders():
            ord_obj.status = "assigned"

    db.commit()
    db.refresh(new_route)

    return get_active_route(db, shipper_id=shipper_id)


def complete_stop(db: Session, route_id: int, stop_id: int) -> Optional[RouteOut]:
    stop = db.query(RouteStop).filter(RouteStop.id == stop_id, RouteStop.route_id == route_id).first()
    if not stop:
        return None

    stop.status = "done"

    # Update corresponding order status
    if stop.ref_order_id is not None:
        order = db.query(Order).filter(Order.id == stop.ref_order_id).first()
        if order:
            if stop.stop_type == "pickup":
                order.status = "picked_up"
            elif stop.stop_type == "delivery":
                order.status = "delivered"

    # Check if all stops are done
    all_stops = db.query(RouteStop).filter(RouteStop.route_id == route_id).all()
    if all(s.status == "done" for s in all_stops):
        route = db.query(Route).filter(Route.id == route_id).first()
        if route:
            route.status = "completed"

    db.commit()

    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        return None

    orders_map = {o.id: o for o in db.query(Order).all()}
    stations_map = {s.id: s for s in db.query(Station).all()}
    enriched = enrich_route_stops(route.stops, orders_map, stations_map)
    route_geo = build_route_segments(db, enriched)
    db.commit()

    return RouteOut(
        id=route.id,
        shipper_id=route.shipper_id,
        total_cost=round(route.total_cost, 2),
        total_distance_km=route_geo["total_distance_km"],
        total_duration_seconds=route_geo["total_duration_seconds"],
        geometry_source=route_geo["geometry_source"],
        matrix_source=cost_module.get_distance_matrix_meta()["source"],
        battery_capacity_kwh=settings.BATTERY_CAPACITY_B,
        geometry=route_geo["geometry"],
        segments=route_geo["segments"],
        status=route.status,
        created_at=route.created_at,
        updated_at=route.updated_at,
        stops=enriched
    )


async def handle_station_status_event(station_id: int, is_available: bool, event_log_id: Optional[int] = None, triggered_at: Optional[str] = None):
    """Event subscriber triggered whenever a station's availability changes."""
    # Always notify web clients of station status toggle
    await event_bus.broadcast_all({
        "event": "station_status_changed",
        "station_id": station_id,
        "is_available": is_available,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

    if is_available:
        return  # Only reactively patch if a station goes DOWN

    db = SessionLocal()
    try:
        active_routes = db.query(Route).filter(Route.status == "active").all()
        orders_map = {o.id: o for o in db.query(Order).all()}
        stations_map = {s.id: s for s in db.query(Station).all()}

        for route in active_routes:
            # Check if this station is in the pending stops of the route
            has_failed_station = any(
                s.stop_type == "swap_station" and s.ref_station_id == station_id and s.status == "pending"
                for s in route.stops
            )
            if not has_failed_station:
                continue

            # Build list of Stop dataclasses
            core_stops: List[Stop] = []
            for s in route.stops:
                lat, lng, weight, label = settings.DEPOT_LAT, settings.DEPOT_LNG, 0.0, "Depot"
                if s.stop_type == "pickup" and s.ref_order_id in orders_map:
                    o = orders_map[s.ref_order_id]
                    lat, lng, weight, label = o.pickup_lat, o.pickup_lng, o.weight, f"Pickup #{o.id}"
                elif s.stop_type == "delivery" and s.ref_order_id in orders_map:
                    o = orders_map[s.ref_order_id]
                    lat, lng, weight, label = o.delivery_lat, o.delivery_lng, o.weight, f"Delivery #{o.id}"
                elif s.stop_type == "swap_station" and s.ref_station_id in stations_map:
                    st = stations_map[s.ref_station_id]
                    lat, lng, label = st.lat, st.lng, st.name

                core_stops.append(
                    Stop(
                        stop_type=s.stop_type,
                        lat=lat,
                        lng=lng,
                        ref_order_id=s.ref_order_id,
                        ref_station_id=s.ref_station_id,
                        weight=weight,
                        status=s.status,
                        label=label
                    )
                )

            # Apply local patch
            patch_res = apply_local_patch(core_stops, station_id, stations_map, orders_map)
            now_utc = datetime.now(timezone.utc)

            if patch_res.success:
                # Update DB route stops
                db.query(RouteStop).filter(RouteStop.route_id == route.id).delete()
                for idx, ps in enumerate(patch_res.updated_stops):
                    new_rs = RouteStop(
                        route_id=route.id,
                        sequence_index=idx,
                        stop_type=ps.stop_type,
                        ref_order_id=ps.ref_order_id,
                        ref_station_id=ps.ref_station_id,
                        status=ps.status
                    )
                    db.add(new_rs)

                route.total_cost = patch_res.total_cost
                route.updated_at = now_utc

                # Log route_patched event
                resolved_event = EventLog(
                    event_type="route_patched",
                    payload=json.dumps({
                        "route_id": route.id,
                        "old_station": patch_res.old_station,
                        "new_station": patch_res.new_station,
                        "latency_ms": patch_res.latency_ms,
                        "total_cost": patch_res.total_cost
                    }),
                    triggered_at=datetime.fromisoformat(triggered_at) if triggered_at else now_utc,
                    resolved_at=now_utc
                )
                db.add(resolved_event)
                db.commit()

                # Refresh and enrich updated route
                db.refresh(route)
                enriched_stops = enrich_route_stops(route.stops, orders_map, stations_map)
                route_geo = build_route_segments(db, enriched_stops)
                db.commit()

                # Broadcast patch event via WebSocket
                patch_payload = {
                    "event": "route_patched",
                    "reason": "station_unavailable",
                    "old_stop": patch_res.old_station,
                    "new_stop": patch_res.new_station,
                    "updated_stops": [s.model_dump() for s in enriched_stops],
                    "geometry": route_geo["geometry"],
                    "segments": route_geo["segments"],
                    "total_cost": round(patch_res.total_cost, 2),
                    "total_distance_km": route_geo["total_distance_km"],
                    "total_duration_seconds": route_geo["total_duration_seconds"],
                    "latency_ms": round(patch_res.latency_ms, 2),
                    "timestamp": now_utc.isoformat()
                }
                await event_bus.broadcast_to_shipper(route.shipper_id, patch_payload)
            else:
                # Log patch failure
                failed_event = EventLog(
                    event_type="route_patch_failed",
                    payload=json.dumps({
                        "route_id": route.id,
                        "station_id": station_id,
                        "reason": patch_res.reason,
                        "latency_ms": patch_res.latency_ms
                    }),
                    triggered_at=datetime.fromisoformat(triggered_at) if triggered_at else now_utc,
                    resolved_at=now_utc
                )
                db.add(failed_event)
                db.commit()

                # Broadcast failure event
                fail_payload = {
                    "event": "route_patch_failed",
                    "reason": patch_res.reason,
                    "station_id": station_id,
                    "latency_ms": round(patch_res.latency_ms, 2),
                    "timestamp": now_utc.isoformat()
                }
                await event_bus.broadcast_to_shipper(route.shipper_id, fail_payload)
    finally:
        db.close()


async def handle_new_order_event(shipper_id: int = 1) -> Dict[str, Any]:
    """
    Reactive event: a brand-new order (random pickup/delivery in Hanoi) shows up
    while the shipper is mid-drive. Inserts it into the active route's mutable
    suffix only (frozen prefix — done stops + the stop currently being driven to
    — is never touched), reusing the same insertion/charging-repair logic ALNS
    itself uses, then pushes the patched route over WebSocket the same way a
    station-down reroute does.
    """
    start_time = time.perf_counter()
    db = SessionLocal()
    try:
        route = db.query(Route).filter(Route.shipper_id == shipper_id, Route.status == "active").order_by(Route.id.desc()).first()
        if not route or not route.stops:
            return {"success": False, "reason": "No active route to inject a new order into"}

        order = create_order(db, OrderCreate(**random_order_coords()))

        orders_map = {o.id: o for o in db.query(Order).all()}
        stations_map = {s.id: s for s in db.query(Station).all()}

        core_stops: List[Stop] = []
        for s in route.stops:
            lat, lng, weight, label = settings.DEPOT_LAT, settings.DEPOT_LNG, 0.0, "Depot"
            if s.stop_type == "pickup" and s.ref_order_id in orders_map:
                o = orders_map[s.ref_order_id]
                lat, lng, weight, label = o.pickup_lat, o.pickup_lng, o.weight, f"Pickup #{o.id}"
            elif s.stop_type == "delivery" and s.ref_order_id in orders_map:
                o = orders_map[s.ref_order_id]
                lat, lng, weight, label = o.delivery_lat, o.delivery_lng, o.weight, f"Delivery #{o.id}"
            elif s.stop_type == "swap_station" and s.ref_station_id in stations_map:
                st = stations_map[s.ref_station_id]
                lat, lng, label = st.lat, st.lng, st.name

            core_stops.append(
                Stop(
                    stop_type=s.stop_type,
                    lat=lat,
                    lng=lng,
                    ref_order_id=s.ref_order_id,
                    ref_station_id=s.ref_station_id,
                    weight=weight,
                    status=s.status,
                    label=label
                )
            )

        # Frozen boundary: index right after the last completed stop. Insertion may
        # never land before this index (de_bai.md section 4 Frozen Prefix rule).
        frozen_boundary = 0
        for i, s in enumerate(core_stops):
            if s.status == "done":
                frozen_boundary = i + 1
            else:
                break

        # Extend the road-distance matrix to cover the new order's two points too.
        all_points = [(s.lat, s.lng) for s in core_stops]
        all_points.append((order.pickup_lat, order.pickup_lng))
        all_points.append((order.delivery_lat, order.delivery_lng))
        all_points.extend((st.lat, st.lng) for st in stations_map.values())
        matrix_info = build_and_warm_distance_matrix(all_points)

        candidates = evaluate_order_insertion_positions(
            core_stops, order.id, order, stations_map, min_index=frozen_boundary
        )
        now_utc = datetime.now(timezone.utc)
        latency_ms = (time.perf_counter() - start_time) * 1000.0

        if not candidates:
            db.add(EventLog(
                event_type="order_insert_failed",
                payload=json.dumps({
                    "route_id": route.id,
                    "order_id": order.id,
                    "reason": "No feasible insertion in mutable suffix"
                }),
                triggered_at=now_utc,
                resolved_at=now_utc
            ))
            db.commit()

            fail_payload = {
                "event": "route_patch_failed",
                "reason": "No feasible insertion for new order in mutable suffix",
                "order_id": order.id,
                "latency_ms": round(latency_ms, 2),
                "timestamp": now_utc.isoformat()
            }
            await event_bus.broadcast_to_shipper(shipper_id, fail_payload)
            return {"success": False, "reason": "No feasible insertion in mutable suffix", "order_id": order.id}

        best_cost, best_stops = candidates[0]
        eval_res = check_feasibility_and_cost(
            best_stops,
            stations_map=stations_map,
            capacity=settings.VEHICLE_CAPACITY_Q,
            battery_max=settings.BATTERY_CAPACITY_B,
            base_rate=settings.BASE_CONSUMPTION_RATE,
            load_factor=settings.LOAD_CONSUMPTION_FACTOR
        )

        db.query(RouteStop).filter(RouteStop.route_id == route.id).delete()
        for idx, s in enumerate(best_stops):
            db.add(RouteStop(
                route_id=route.id,
                sequence_index=idx,
                stop_type=s.stop_type,
                ref_order_id=s.ref_order_id,
                ref_station_id=s.ref_station_id,
                status=s.status
            ))

        order.status = "assigned"
        route.total_cost = eval_res.total_cost
        route.updated_at = now_utc

        db.add(EventLog(
            event_type="order_inserted",
            payload=json.dumps({
                "route_id": route.id,
                "order_id": order.id,
                "total_cost": eval_res.total_cost,
                "latency_ms": latency_ms
            }),
            triggered_at=now_utc,
            resolved_at=now_utc
        ))
        db.commit()
        db.refresh(route)

        enriched_stops = enrich_route_stops(route.stops, orders_map, stations_map)
        route_geo = build_route_segments(db, enriched_stops)
        db.commit()

        patch_payload = {
            "event": "route_patched",
            "reason": "new_order_added",
            "old_stop": None,
            "new_stop": {
                "type": "order",
                "order_id": order.id,
                "label": f"New Order #{order.id}"
            },
            "updated_stops": [s.model_dump() for s in enriched_stops],
            "geometry": route_geo["geometry"],
            "segments": route_geo["segments"],
            "total_cost": round(eval_res.total_cost, 2),
            "total_distance_km": route_geo["total_distance_km"],
            "total_duration_seconds": route_geo["total_duration_seconds"],
            "matrix_source": matrix_info.get("source"),
            "latency_ms": round(latency_ms, 2),
            "timestamp": now_utc.isoformat()
        }
        await event_bus.broadcast_to_shipper(shipper_id, patch_payload)

        return {
            "success": True,
            "order_id": order.id,
            "total_cost": eval_res.total_cost,
            "latency_ms": latency_ms,
            "matrix_source": matrix_info.get("source")
        }
    finally:
        db.close()
