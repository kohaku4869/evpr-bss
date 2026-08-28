import time
from dataclasses import dataclass
from typing import List, Dict, Any, Optional, Tuple
from app.core.feasibility import Stop, check_feasibility_and_cost, RouteEvaluation
from app.core.cost import delta_station_cost
from app.core.alns.repair_operators import repair_battery_with_charging_stations
from app.config import settings


@dataclass
class PatchResult:
    success: bool
    reason: str
    updated_stops: List[Stop]
    old_station: Optional[Dict[str, Any]] = None
    new_station: Optional[Dict[str, Any]] = None
    total_cost: float = 0.0
    latency_ms: float = 0.0


def apply_local_patch(
    current_stops: List[Stop],
    failed_station_id: int,
    stations_map: Dict[int, Any],
    orders_map: Optional[Dict[int, Any]] = None
) -> PatchResult:
    """
    Performs real-time local patch (< 1.5s) when a swap station becomes unavailable.
    Preserves Frozen Prefix (done stops) and only repairs the Mutable Suffix (pending stops).
    """
    start_time = time.perf_counter()

    # 1. Find the target station in the mutable suffix (status == 'pending')
    target_idx = -1
    for idx, stop in enumerate(current_stops):
        if stop.stop_type == "swap_station" and stop.ref_station_id == failed_station_id:
            if stop.status == "pending":
                target_idx = idx
                break
            else:
                # Target station is already done / in frozen prefix -> ignore
                latency_ms = (time.perf_counter() - start_time) * 1000.0
                return PatchResult(
                    success=False,
                    reason="Target station is in Frozen Prefix (already completed) or not pending",
                    updated_stops=current_stops,
                    latency_ms=latency_ms
                )

    if target_idx == -1:
        # Station is not present in the pending route
        latency_ms = (time.perf_counter() - start_time) * 1000.0
        return PatchResult(
            success=False,
            reason="Failed station is not in the active route's pending stops",
            updated_stops=current_stops,
            latency_ms=latency_ms
        )

    old_stop = current_stops[target_idx]
    old_station_info = {
        "type": "swap_station",
        "station_id": failed_station_id,
        "label": old_stop.label,
        "lat": old_stop.lat,
        "lng": old_stop.lng
    }

    u = current_stops[target_idx - 1]
    v = current_stops[target_idx + 1] if target_idx + 1 < len(current_stops) else None

    # 2. Candidate available stations (excluding the failed station)
    best_candidate_stops = None
    best_station_info = None
    min_delta_cost = float("inf")

    # Map with failed station marked unavailable
    simulated_stations_map = dict(stations_map)
    # Ensure failed station is marked unavailable in simulation
    if failed_station_id in simulated_stations_map:
        failed_obj = simulated_stations_map[failed_station_id]
        if isinstance(failed_obj, dict):
            simulated_stations_map[failed_station_id] = {**failed_obj, "is_available": False}

    for st_id, st in simulated_stations_map.items():
        if st_id == failed_station_id:
            continue

        is_avail = getattr(st, "is_available", True) if not isinstance(st, dict) else st.get("is_available", True)
        if not is_avail:
            continue

        st_lat = getattr(st, "lat", 0.0) if not isinstance(st, dict) else st.get("lat", 0.0)
        st_lng = getattr(st, "lng", 0.0) if not isinstance(st, dict) else st.get("lng", 0.0)
        st_cost = getattr(st, "cost_swap", settings.DEFAULT_SWAP_COST) if not isinstance(st, dict) else st.get("cost_swap", settings.DEFAULT_SWAP_COST)
        st_name = getattr(st, "name", f"Station {st_id}") if not isinstance(st, dict) else st.get("name", f"Station {st_id}")

        new_station_stop = Stop(
            stop_type="swap_station",
            lat=st_lat,
            lng=st_lng,
            ref_station_id=st_id,
            status="pending",
            label=st_name
        )

        candidate_stops = current_stops[:target_idx] + [new_station_stop] + current_stops[target_idx + 1:]

        # Validate feasibility
        eval_res = check_feasibility_and_cost(
            candidate_stops,
            stations_map=simulated_stations_map,
            capacity=settings.VEHICLE_CAPACITY_Q,
            battery_max=settings.BATTERY_CAPACITY_B,
            base_rate=settings.BASE_CONSUMPTION_RATE,
            load_factor=settings.LOAD_CONSUMPTION_FACTOR,
            default_swap_cost=settings.DEFAULT_SWAP_COST
        )

        if eval_res.is_feasible:
            v_coords = v.coords if v else u.coords
            d_cost = delta_station_cost(u.coords, (st_lat, st_lng), v_coords, st_cost)
            if d_cost < min_delta_cost:
                min_delta_cost = d_cost
                best_candidate_stops = candidate_stops
                best_station_info = {
                    "type": "swap_station",
                    "station_id": st_id,
                    "label": st_name,
                    "lat": st_lat,
                    "lng": st_lng,
                    "cost_swap": st_cost
                }

    # 3. Direct replacement found
    if best_candidate_stops is not None:
        eval_res = check_feasibility_and_cost(best_candidate_stops, stations_map=simulated_stations_map)
        latency_ms = (time.perf_counter() - start_time) * 1000.0
        return PatchResult(
            success=True,
            reason="station_unavailable",
            updated_stops=best_candidate_stops,
            old_station=old_station_info,
            new_station=best_station_info,
            total_cost=eval_res.total_cost,
            latency_ms=latency_ms
        )

    # 4. Fallback: Charging-aware repair on mutable suffix
    stops_without_failed = current_stops[:target_idx] + current_stops[target_idx + 1:]
    repaired_stops = repair_battery_with_charging_stations(
        stops_without_failed,
        stations_map=simulated_stations_map
    )

    if repaired_stops is not None:
        eval_res = check_feasibility_and_cost(repaired_stops, stations_map=simulated_stations_map)
        if eval_res.is_feasible:
            latency_ms = (time.perf_counter() - start_time) * 1000.0
            return PatchResult(
                success=True,
                reason="station_unavailable_fallback_inserted",
                updated_stops=repaired_stops,
                old_station=old_station_info,
                new_station={"type": "swap_station", "info": "repaired_via_fallback"},
                total_cost=eval_res.total_cost,
                latency_ms=latency_ms
            )

    # 5. Complete failure to find replacement (Preserve existing route, log failure)
    latency_ms = (time.perf_counter() - start_time) * 1000.0
    return PatchResult(
        success=False,
        reason="No feasible alternative swap station found",
        updated_stops=current_stops,
        old_station=old_station_info,
        new_station=None,
        latency_ms=latency_ms
    )
