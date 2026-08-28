from typing import List, Dict, Any, Optional, Tuple
from app.core.feasibility import Stop, check_feasibility_and_cost
from app.core.alns.solution import Solution
from app.core.cost import delta_station_cost, calculate_leg_cost, energy_consumption
from app.config import settings


def try_insert_swap_station_for_leg(
    stops: List[Stop],
    stations_map: Dict[int, Any],
    leg_idx: int,
    capacity: float = settings.VEHICLE_CAPACITY_Q,
    battery_max: float = settings.BATTERY_CAPACITY_B,
    base_rate: float = settings.BASE_CONSUMPTION_RATE,
    load_factor: float = settings.LOAD_CONSUMPTION_FACTOR
) -> Optional[List[Stop]]:
    """
    Attempts to fix battery depletion between stops[leg_idx-1] and stops[leg_idx]
    by inserting an available swap station between them.
    """
    if leg_idx <= 0 or leg_idx >= len(stops):
        return None

    u = stops[leg_idx - 1]
    v = stops[leg_idx]

    best_candidate_stops = None
    min_delta = float("inf")

    # Evaluate all available stations
    for st_id, st in stations_map.items():
        is_avail = getattr(st, "is_available", True) if not isinstance(st, dict) else st.get("is_available", True)
        if not is_avail:
            continue

        st_lat = getattr(st, "lat", 0.0) if not isinstance(st, dict) else st.get("lat", 0.0)
        st_lng = getattr(st, "lng", 0.0) if not isinstance(st, dict) else st.get("lng", 0.0)
        st_cost = getattr(st, "cost_swap", settings.DEFAULT_SWAP_COST) if not isinstance(st, dict) else st.get("cost_swap", settings.DEFAULT_SWAP_COST)
        st_name = getattr(st, "name", f"Station {st_id}") if not isinstance(st, dict) else st.get("name", f"Station {st_id}")

        station_stop = Stop(
            stop_type="swap_station",
            lat=st_lat,
            lng=st_lng,
            ref_station_id=st_id,
            label=st_name
        )

        test_stops = stops[:leg_idx] + [station_stop] + stops[leg_idx:]
        eval_res = check_feasibility_and_cost(
            test_stops,
            stations_map=stations_map,
            capacity=capacity,
            battery_max=battery_max,
            base_rate=base_rate,
            load_factor=load_factor,
            default_swap_cost=settings.DEFAULT_SWAP_COST
        )

        if eval_res.is_feasible:
            d_cost = delta_station_cost(u.coords, (st_lat, st_lng), v.coords, st_cost)
            if d_cost < min_delta:
                min_delta = d_cost
                best_candidate_stops = test_stops

    return best_candidate_stops


def repair_battery_with_charging_stations(
    stops: List[Stop],
    stations_map: Dict[int, Any],
    max_stations_to_add: int = 3
) -> Optional[List[Stop]]:
    """
    Iteratively inserts swap stations whenever a route encounters battery depletion.
    """
    current_stops = list(stops)
    for _ in range(max_stations_to_add):
        eval_res = check_feasibility_and_cost(
            current_stops,
            stations_map=stations_map,
            capacity=settings.VEHICLE_CAPACITY_Q,
            battery_max=settings.BATTERY_CAPACITY_B,
            base_rate=settings.BASE_CONSUMPTION_RATE,
            load_factor=settings.LOAD_CONSUMPTION_FACTOR
        )
        if eval_res.is_feasible:
            return current_stops

        if eval_res.reason and "Battery depleted" in eval_res.reason:
            # Find the first leg where battery becomes negative
            # Evaluate step by step
            battery = settings.BATTERY_CAPACITY_B
            load = 0.0
            depleted_idx = -1
            for k in range(len(current_stops)):
                if k == 0:
                    battery = settings.BATTERY_CAPACITY_B
                else:
                    dist = calculate_leg_cost(current_stops[k-1].coords, current_stops[k].coords)
                    energy = energy_consumption(dist, load, settings.BASE_CONSUMPTION_RATE, settings.LOAD_CONSUMPTION_FACTOR)
                    battery -= energy
                    if battery < -1e-6:
                        depleted_idx = k
                        break

                # Apply stop action
                st = current_stops[k]
                if st.stop_type == "pickup":
                    load += st.weight
                elif st.stop_type == "delivery":
                    load -= st.weight
                elif st.stop_type == "swap_station":
                    battery = settings.BATTERY_CAPACITY_B

            if depleted_idx != -1:
                # Try inserting a station on depleted_idx or previous legs
                patched = None
                for leg in range(depleted_idx, 0, -1):
                    patched = try_insert_swap_station_for_leg(current_stops, stations_map, leg)
                    if patched is not None:
                        current_stops = patched
                        break
                if patched is None:
                    # Could not find any feasible station insertion
                    return None
            else:
                return None
        else:
            # Infeasibility is not battery related (e.g. capacity or precedence)
            return None

    return None


def evaluate_order_insertion_positions(
    current_stops: List[Stop],
    order_id: int,
    order: Any,
    stations_map: Dict[int, Any],
    min_index: Optional[int] = None
) -> List[Tuple[float, List[Stop]]]:
    """
    Evaluates all valid (p_idx, d_idx) insertion positions for order_id.
    Returns sorted list of (cost, candidate_stops).

    `min_index` restricts the earliest index a new stop may be inserted at —
    used by the reactive "new order mid-drive" flow to keep insertions inside
    the mutable suffix, never disturbing the frozen prefix. When omitted, the
    only restriction is skipping past a leading depot stop (default ALNS
    behavior when building/repairing a route from scratch).
    """
    p_lat = getattr(order, "pickup_lat", 0.0) if not isinstance(order, dict) else order.get("pickup_lat", 0.0)
    p_lng = getattr(order, "pickup_lng", 0.0) if not isinstance(order, dict) else order.get("pickup_lng", 0.0)
    d_lat = getattr(order, "delivery_lat", 0.0) if not isinstance(order, dict) else order.get("delivery_lat", 0.0)
    d_lng = getattr(order, "delivery_lng", 0.0) if not isinstance(order, dict) else order.get("delivery_lng", 0.0)
    weight = getattr(order, "weight", 1.0) if not isinstance(order, dict) else order.get("weight", 1.0)

    p_stop = Stop(stop_type="pickup", lat=p_lat, lng=p_lng, ref_order_id=order_id, weight=weight, label=f"Pickup #{order_id}")
    d_stop = Stop(stop_type="delivery", lat=d_lat, lng=d_lng, ref_order_id=order_id, weight=weight, label=f"Delivery #{order_id}")

    candidates: List[Tuple[float, List[Stop]]] = []

    # Insert positions: start after depot (index 1) to end, unless min_index overrides it
    if min_index is not None:
        start_pos = max(0, min_index)
    else:
        start_pos = 1 if current_stops and current_stops[0].stop_type == "depot" else 0
    n = len(current_stops)

    for p_idx in range(start_pos, n + 1):
        stops_with_p = current_stops[:p_idx] + [p_stop] + current_stops[p_idx:]
        for d_idx in range(p_idx + 1, len(stops_with_p) + 1):
            candidate = stops_with_p[:d_idx] + [d_stop] + stops_with_p[d_idx:]

            eval_res = check_feasibility_and_cost(
                candidate,
                stations_map=stations_map,
                capacity=settings.VEHICLE_CAPACITY_Q,
                battery_max=settings.BATTERY_CAPACITY_B,
                base_rate=settings.BASE_CONSUMPTION_RATE,
                load_factor=settings.LOAD_CONSUMPTION_FACTOR
            )

            if eval_res.is_feasible:
                candidates.append((eval_res.total_cost, candidate))
            elif eval_res.reason and "Battery depleted" in eval_res.reason:
                # Try charging aware insertion
                repaired = repair_battery_with_charging_stations(candidate, stations_map)
                if repaired is not None:
                    repaired_eval = check_feasibility_and_cost(
                        repaired,
                        stations_map=stations_map,
                        capacity=settings.VEHICLE_CAPACITY_Q,
                        battery_max=settings.BATTERY_CAPACITY_B,
                        base_rate=settings.BASE_CONSUMPTION_RATE,
                        load_factor=settings.LOAD_CONSUMPTION_FACTOR
                    )
                    if repaired_eval.is_feasible:
                        candidates.append((repaired_eval.total_cost, repaired))

    candidates.sort(key=lambda x: x[0])
    return candidates


def greedy_insertion(
    solution: Solution,
    unassigned_order_ids: Optional[List[int]] = None
) -> Solution:
    """
    r1: Greedy Insertion with Battery Check
    Iteratively inserts each unassigned order at its best (lowest cost) feasible position.
    """
    sol = solution.copy()
    to_assign = list(unassigned_order_ids) if unassigned_order_ids is not None else list(sol.unassigned_orders)

    while to_assign:
        order_id = to_assign.pop(0)
        order = sol.orders_map.get(order_id)
        if not order:
            continue

        candidates = evaluate_order_insertion_positions(sol.stops, order_id, order, sol.stations_map)
        if candidates:
            best_cost, best_stops = candidates[0]
            sol.stops = best_stops
            sol.evaluate()
            if order_id in sol.unassigned_orders:
                sol.unassigned_orders.remove(order_id)
        else:
            # Cannot insert feasibly
            if order_id not in sol.unassigned_orders:
                sol.unassigned_orders.append(order_id)

    return sol


def regret_k_insertion(
    solution: Solution,
    unassigned_order_ids: Optional[List[int]] = None,
    k: int = 2
) -> Solution:
    """
    r2: Regret-k Insertion (k=2)
    For each unassigned order, computes best cost c_1 and second best cost c_2.
    Regret = c_2 - c_1.
    Inserts the order with maximum regret first.
    """
    sol = solution.copy()
    to_assign = list(unassigned_order_ids) if unassigned_order_ids is not None else list(sol.unassigned_orders)

    while to_assign:
        best_order_id = None
        max_regret = -float("inf")
        best_candidate_stops = None

        for order_id in to_assign:
            order = sol.orders_map.get(order_id)
            if not order:
                continue

            candidates = evaluate_order_insertion_positions(sol.stops, order_id, order, sol.stations_map)
            if not candidates:
                continue

            c1 = candidates[0][0]
            c2 = candidates[1][0] if len(candidates) >= 2 else c1 + 100.0  # High penalty if only 1 option
            regret = c2 - c1

            if regret > max_regret:
                max_regret = regret
                best_order_id = order_id
                best_candidate_stops = candidates[0][1]

        if best_order_id is not None and best_candidate_stops is not None:
            sol.stops = best_candidate_stops
            sol.evaluate()
            to_assign.remove(best_order_id)
            if best_order_id in sol.unassigned_orders:
                sol.unassigned_orders.remove(best_order_id)
        else:
            # None of remaining orders can be feasibly inserted
            break

    sol.unassigned_orders = to_assign
    return sol
