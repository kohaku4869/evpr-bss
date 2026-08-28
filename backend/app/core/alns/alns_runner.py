import time
import random
from typing import Dict, Any, List, Optional, Tuple
from app.config import settings
from app.core.feasibility import Stop
from app.core.alns.solution import Solution
from app.core.alns.destroy_operators import (
    random_pair_removal,
    worst_cost_pair_removal,
    shaw_pair_removal,
    redundant_station_removal
)
from app.core.alns.repair_operators import (
    greedy_insertion,
    regret_k_insertion
)
from app.core.alns.acceptance import SimulatedAnnealing
from app.core.alns.weights import AdaptiveWeights


class ALNSRunner:
    def __init__(
        self,
        orders: List[Any],
        stations: List[Any],
        depot_lat: float = settings.DEPOT_LAT,
        depot_lng: float = settings.DEPOT_LNG,
        random_seed: Optional[int] = settings.ALNS_RANDOM_SEED
    ):
        self.orders_map: Dict[int, Any] = {
            (getattr(o, "id", None) if not isinstance(o, dict) else o["id"]): o
            for o in orders
        }
        self.stations_map: Dict[int, Any] = {
            (getattr(s, "id", None) if not isinstance(s, dict) else s["id"]): s
            for s in stations
        }
        self.depot_lat = depot_lat
        self.depot_lng = depot_lng
        self.random_seed = random_seed

        # Destroy and Repair Operator Registry
        self.destroy_operators = [
            ("random_removal", lambda sol: random_pair_removal(sol, q=max(1, len(sol.get_served_orders()) // 3))),
            ("worst_cost_removal", lambda sol: worst_cost_pair_removal(sol, q=max(1, len(sol.get_served_orders()) // 3))),
            ("shaw_removal", lambda sol: shaw_pair_removal(sol, q=max(1, len(sol.get_served_orders()) // 3))),
            ("redundant_station_removal", lambda sol: redundant_station_removal(sol))
        ]

        self.repair_operators = [
            ("greedy_insertion", lambda sol, removed: greedy_insertion(sol, removed)),
            ("regret2_insertion", lambda sol, removed: regret_k_insertion(sol, removed, k=2))
        ]

    def construct_initial_solution(self) -> Solution:
        """
        Builds initial solution starting at Depot, sequentially inserting orders
        via greedy insertion with battery repair.
        """
        depot_stop = Stop(
            stop_type="depot",
            lat=self.depot_lat,
            lng=self.depot_lng,
            ref_order_id=None,
            ref_station_id=None,
            weight=0.0,
            status="done",
            label="Depot"
        )
        all_order_ids = list(self.orders_map.keys())
        init_sol = Solution(
            stops=[depot_stop],
            orders_map=self.orders_map,
            stations_map=self.stations_map,
            unassigned_orders=all_order_ids
        )
        return greedy_insertion(init_sol, all_order_ids)

    def run(
        self,
        max_iterations: int = settings.ALNS_MAX_ITERATIONS,
        time_limit_seconds: float = settings.ALNS_TIME_LIMIT_SECONDS,
        start_temperature: float = settings.ALNS_START_TEMPERATURE,
        cooling_rate: float = settings.ALNS_COOLING_RATE,
        segment_length: int = settings.ALNS_SEGMENT_LENGTH
    ) -> Solution:
        if self.random_seed is not None:
            random.seed(self.random_seed)

        start_time = time.time()

        # 1. Initial Solution
        current_sol = self.construct_initial_solution()
        best_sol = current_sol.copy()

        # 2. Acceptance & Weights
        acceptance = SimulatedAnnealing(start_temperature=start_temperature, cooling_rate=cooling_rate)
        weights = AdaptiveWeights(
            destroy_operators=self.destroy_operators,
            repair_operators=self.repair_operators,
            segment_length=segment_length
        )

        iteration = 0
        while iteration < max_iterations:
            if time.time() - start_time >= time_limit_seconds:
                break

            destroy_op = weights.select_destroy()
            repair_op = weights.select_repair()

            # Destroy step
            removed_orders, partial_sol = destroy_op.func(current_sol)

            # Repair step
            candidate_sol = repair_op.func(partial_sol, removed_orders)

            # Feasibility and quality check
            if candidate_sol.is_feasible:
                # Prioritize serving all orders
                served_more = len(candidate_sol.unassigned_orders) < len(best_sol.unassigned_orders)
                same_served = len(candidate_sol.unassigned_orders) == len(best_sol.unassigned_orders)

                if served_more or (same_served and candidate_sol.cost < best_sol.cost):
                    best_sol = candidate_sol.copy()
                    current_sol = candidate_sol.copy()
                    weights.reward(destroy_op, repair_op, settings.ALNS_SCORE_SIGMA1)
                elif same_served and candidate_sol.cost < current_sol.cost:
                    current_sol = candidate_sol.copy()
                    weights.reward(destroy_op, repair_op, settings.ALNS_SCORE_SIGMA2)
                elif same_served and acceptance.accept(current_sol.cost, candidate_sol.cost):
                    current_sol = candidate_sol.copy()
                    weights.reward(destroy_op, repair_op, settings.ALNS_SCORE_SIGMA3)

            acceptance.cool()
            iteration += 1

            if iteration % segment_length == 0:
                weights.update_segment_weights()

        return best_sol
