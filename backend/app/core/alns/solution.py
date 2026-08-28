from typing import List, Dict, Any, Optional, Set
from app.core.feasibility import Stop, RouteEvaluation, check_feasibility_and_cost
from app.config import settings


class Solution:
    def __init__(
        self,
        stops: Optional[List[Stop]] = None,
        orders_map: Optional[Dict[int, Any]] = None,
        stations_map: Optional[Dict[int, Any]] = None,
        unassigned_orders: Optional[List[int]] = None
    ):
        self.stops: List[Stop] = [s.clone() for s in stops] if stops else []
        self.orders_map: Dict[int, Any] = orders_map or {}
        self.stations_map: Dict[int, Any] = stations_map or {}
        self.unassigned_orders: List[int] = list(unassigned_orders) if unassigned_orders is not None else []
        self.evaluation: Optional[RouteEvaluation] = None
        self.evaluate()

    def evaluate(self) -> RouteEvaluation:
        self.evaluation = check_feasibility_and_cost(
            stops=self.stops,
            stations_map=self.stations_map,
            capacity=settings.VEHICLE_CAPACITY_Q,
            battery_max=settings.BATTERY_CAPACITY_B,
            base_rate=settings.BASE_CONSUMPTION_RATE,
            load_factor=settings.LOAD_CONSUMPTION_FACTOR,
            default_swap_cost=settings.DEFAULT_SWAP_COST
        )
        return self.evaluation

    @property
    def cost(self) -> float:
        if self.evaluation is None:
            self.evaluate()
        return self.evaluation.total_cost

    @property
    def is_feasible(self) -> bool:
        if self.evaluation is None:
            self.evaluate()
        return self.evaluation.is_feasible

    def get_served_orders(self) -> Set[int]:
        return {s.ref_order_id for s in self.stops if s.ref_order_id is not None}

    def remove_order(self, order_id: int) -> bool:
        """Removes both pickup and delivery stops of order_id."""
        initial_len = len(self.stops)
        self.stops = [s for s in self.stops if s.ref_order_id != order_id]
        if len(self.stops) < initial_len:
            if order_id not in self.unassigned_orders:
                self.unassigned_orders.append(order_id)
            self.evaluate()
            return True
        return False

    def remove_station_at(self, index: int) -> bool:
        """Removes swap station at the given stop index."""
        if 0 <= index < len(self.stops) and self.stops[index].stop_type == "swap_station":
            del self.stops[index]
            self.evaluate()
            return True
        return False

    def copy(self) -> "Solution":
        new_sol = Solution(
            stops=self.stops,
            orders_map=self.orders_map,
            stations_map=self.stations_map,
            unassigned_orders=self.unassigned_orders
        )
        new_sol.evaluation = self.evaluation
        return new_sol
