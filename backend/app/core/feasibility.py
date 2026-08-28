from dataclasses import dataclass
from typing import Optional, List, Dict, Tuple, Any
from app.config import settings
from app.core.cost import euclidean_distance, energy_consumption, calculate_leg_cost


@dataclass
class Stop:
    stop_type: str  # 'depot', 'pickup', 'delivery', 'swap_station'
    lat: float
    lng: float
    ref_order_id: Optional[int] = None
    ref_station_id: Optional[int] = None
    weight: float = 0.0  # Weight associated with order
    status: str = "pending"  # 'pending', 'done'
    label: str = ""

    @property
    def coords(self) -> Tuple[float, float]:
        return (self.lat, self.lng)

    def clone(self) -> "Stop":
        return Stop(
            stop_type=self.stop_type,
            lat=self.lat,
            lng=self.lng,
            ref_order_id=self.ref_order_id,
            ref_station_id=self.ref_station_id,
            weight=self.weight,
            status=self.status,
            label=self.label
        )


@dataclass
class RouteEvaluation:
    is_feasible: bool
    total_cost: float
    total_distance: float
    total_swap_cost: float
    reason: Optional[str] = None
    step_loads: List[float] = None  # Load after each stop
    step_batteries: List[float] = None  # Battery upon arrival at each stop
    step_leaving_batteries: List[float] = None  # Battery upon departure from each stop


def check_feasibility_and_cost(
    stops: List[Stop],
    stations_map: Optional[Dict[int, Any]] = None,
    capacity: float = settings.VEHICLE_CAPACITY_Q,
    battery_max: float = settings.BATTERY_CAPACITY_B,
    base_rate: float = settings.BASE_CONSUMPTION_RATE,
    load_factor: float = settings.LOAD_CONSUMPTION_FACTOR,
    default_swap_cost: float = settings.DEFAULT_SWAP_COST,
    min_reserve_ratio: float = settings.BATTERY_MIN_RESERVE_RATIO,
    swap_target_ratio: float = settings.BATTERY_SWAP_TARGET_RATIO
) -> RouteEvaluation:
    """
    Evaluates the full feasibility and cost of a sequence of stops.
    Checks:
    1. Precedence: Pickup before delivery for every order.
    2. Single visit: Each order's pickup and delivery visited at most once.
    3. Vehicle capacity: 0 <= load <= capacity at every stop.
    4. Battery limits: battery >= min_reserve_ratio * battery_max on arrival at every stop
       (a safety reserve, not 0, so unplanned reactive detours still have slack).
    5. Swap station validity: station must be available if stations_map is provided.

    A swap/charge only tops the battery back up to swap_target_ratio * battery_max
    (not a full charge), keeping the reserve model consistent end-to-end.
    """
    min_reserve = battery_max * min_reserve_ratio
    if not stops:
        return RouteEvaluation(
            is_feasible=True,
            total_cost=0.0,
            total_distance=0.0,
            total_swap_cost=0.0,
            step_loads=[],
            step_batteries=[],
            step_leaving_batteries=[]
        )

    # 1. Check Pickup & Delivery pairs and precedence
    pickup_indices: Dict[int, int] = {}
    delivery_indices: Dict[int, int] = {}

    for idx, stop in enumerate(stops):
        if stop.stop_type == "pickup" and stop.ref_order_id is not None:
            if stop.ref_order_id in pickup_indices:
                return RouteEvaluation(
                    is_feasible=False,
                    total_cost=float("inf"),
                    total_distance=float("inf"),
                    total_swap_cost=0.0,
                    reason=f"Duplicate pickup for order {stop.ref_order_id}"
                )
            pickup_indices[stop.ref_order_id] = idx
        elif stop.stop_type == "delivery" and stop.ref_order_id is not None:
            if stop.ref_order_id in delivery_indices:
                return RouteEvaluation(
                    is_feasible=False,
                    total_cost=float("inf"),
                    total_distance=float("inf"),
                    total_swap_cost=0.0,
                    reason=f"Duplicate delivery for order {stop.ref_order_id}"
                )
            delivery_indices[stop.ref_order_id] = idx

    # Every delivery must have a pickup before it
    for order_id, del_idx in delivery_indices.items():
        if order_id not in pickup_indices:
            return RouteEvaluation(
                is_feasible=False,
                total_cost=float("inf"),
                total_distance=float("inf"),
                total_swap_cost=0.0,
                reason=f"Delivery for order {order_id} without pickup"
            )
        if pickup_indices[order_id] > del_idx:
            return RouteEvaluation(
                is_feasible=False,
                total_cost=float("inf"),
                total_distance=float("inf"),
                total_swap_cost=0.0,
                reason=f"Delivery before pickup for order {order_id} (pickup at {pickup_indices[order_id]}, delivery at {del_idx})"
            )

    # 2. Check Capacity & Battery flow along the route
    current_load = 0.0
    current_battery = battery_max
    total_distance = 0.0
    total_swap_cost = 0.0

    step_loads: List[float] = []
    step_batteries: List[float] = []
    step_leaving_batteries: List[float] = []

    for i in range(len(stops)):
        stop = stops[i]

        if i == 0:
            # First stop (e.g. depot)
            arriving_battery = current_battery
        else:
            prev_stop = stops[i - 1]
            leg_dist = calculate_leg_cost(prev_stop.coords, stop.coords)
            total_distance += leg_dist
            energy = energy_consumption(leg_dist, current_load, base_rate, load_factor)
            arriving_battery = current_battery - energy

            # Check battery depletion against the safety reserve floor, not 0
            # (allow small numerical tolerance for floating point).
            if arriving_battery < min_reserve - 1e-6:
                return RouteEvaluation(
                    is_feasible=False,
                    total_cost=float("inf"),
                    total_distance=total_distance,
                    total_swap_cost=total_swap_cost,
                    reason=f"Battery depleted below reserve arriving at stop {i} ({stop.label or stop.stop_type}): battery {arriving_battery:.2f} < reserve {min_reserve:.2f}"
                )

        step_batteries.append(max(0.0, arriving_battery))

        # Handle Stop Action
        leaving_battery = arriving_battery
        if stop.stop_type == "pickup":
            current_load += stop.weight
            if current_load > capacity + 1e-6:
                return RouteEvaluation(
                    is_feasible=False,
                    total_cost=float("inf"),
                    total_distance=total_distance,
                    total_swap_cost=total_swap_cost,
                    reason=f"Vehicle overloaded at stop {i}: load {current_load:.2f} > capacity {capacity}"
                )
        elif stop.stop_type == "delivery":
            current_load -= stop.weight
            if current_load < -1e-6:
                return RouteEvaluation(
                    is_feasible=False,
                    total_cost=float("inf"),
                    total_distance=total_distance,
                    total_swap_cost=total_swap_cost,
                    reason=f"Negative load at stop {i}: load {current_load:.2f} < 0"
                )
        elif stop.stop_type == "swap_station":
            # Check station availability
            swap_cost = default_swap_cost
            if stations_map and stop.ref_station_id is not None:
                st = stations_map.get(stop.ref_station_id)
                if st is not None:
                    # In case of DB model or dict
                    is_avail = getattr(st, "is_available", None) if not isinstance(st, dict) else st.get("is_available")
                    if is_avail is False:
                        return RouteEvaluation(
                            is_feasible=False,
                            total_cost=float("inf"),
                            total_distance=total_distance,
                            total_swap_cost=total_swap_cost,
                            reason=f"Swap station {stop.ref_station_id} is unavailable"
                        )
                    st_cost = getattr(st, "cost_swap", None) if not isinstance(st, dict) else st.get("cost_swap")
                    if st_cost is not None:
                        swap_cost = float(st_cost)

            total_swap_cost += swap_cost
            leaving_battery = battery_max * swap_target_ratio  # Instant swap, topped up to the target reserve level (not 100%)

        current_battery = leaving_battery
        step_leaving_batteries.append(current_battery)
        step_loads.append(current_load)

    total_cost = total_distance + total_swap_cost

    return RouteEvaluation(
        is_feasible=True,
        total_cost=total_cost,
        total_distance=total_distance,
        total_swap_cost=total_swap_cost,
        step_loads=step_loads,
        step_batteries=step_batteries,
        step_leaving_batteries=step_leaving_batteries
    )
