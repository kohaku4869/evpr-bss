import random
from typing import List, Tuple
from app.core.alns.solution import Solution
from app.core.cost import euclidean_distance


def random_pair_removal(solution: Solution, q: int = 2) -> Tuple[List[int], Solution]:
    """
    d1: Random Pair Removal
    Randomly selects q served orders and removes their pickup & delivery stops.
    """
    sol = solution.copy()
    served = list(sol.get_served_orders())
    if not served:
        return [], sol

    num_to_remove = min(q, len(served))
    removed_orders = random.sample(served, num_to_remove)

    for order_id in removed_orders:
        sol.remove_order(order_id)

    return removed_orders, sol


def worst_cost_pair_removal(solution: Solution, q: int = 2, p: float = 3.0) -> Tuple[List[int], Solution]:
    """
    d2: Worst-Cost Pair Removal
    Calculates cost saving delta_c = Cost(s) - Cost(s without {p_i, d_i}) for each order.
    Removes q orders with highest cost savings using randomized tournament selection.
    """
    sol = solution.copy()
    served = list(sol.get_served_orders())
    if not served:
        return [], sol

    base_cost = sol.cost
    cost_savings = []

    for order_id in served:
        test_sol = sol.copy()
        test_sol.remove_order(order_id)
        saving = base_cost - test_sol.cost
        cost_savings.append((order_id, saving))

    # Sort descending by cost savings
    cost_savings.sort(key=lambda x: x[1], reverse=True)

    removed_orders = []
    num_to_remove = min(q, len(served))

    while len(removed_orders) < num_to_remove and cost_savings:
        # Randomized selection: y^p where y in [0, 1)
        rand_val = random.random() ** p
        idx = int(rand_val * len(cost_savings))
        idx = min(idx, len(cost_savings) - 1)
        chosen_order, _ = cost_savings.pop(idx)
        removed_orders.append(chosen_order)
        sol.remove_order(chosen_order)

    return removed_orders, sol


def shaw_pair_removal(
    solution: Solution,
    q: int = 2,
    phi1: float = 1.0,
    phi2: float = 0.5,
    p: float = 3.0
) -> Tuple[List[int], Solution]:
    """
    d3: Related/Shaw Pair Removal
    Removes pairs of orders that are geographically or weight-wise related.
    R(i, j) = phi1 * (dist(p_i, p_j) + dist(d_i, d_j)) + phi2 * |q_i - q_j|
    """
    sol = solution.copy()
    served = list(sol.get_served_orders())
    if not served:
        return [], sol

    num_to_remove = min(q, len(served))
    # Pick a random seed order
    seed_order_id = random.choice(served)
    removed_orders = [seed_order_id]
    sol.remove_order(seed_order_id)
    served.remove(seed_order_id)

    orders_map = sol.orders_map

    while len(removed_orders) < num_to_remove and served:
        # Pick the most recently removed order as reference
        ref_id = removed_orders[-1]
        ref_order = orders_map.get(ref_id)
        if not ref_order:
            break

        ref_p = (getattr(ref_order, "pickup_lat", 0.0), getattr(ref_order, "pickup_lng", 0.0))
        ref_d = (getattr(ref_order, "delivery_lat", 0.0), getattr(ref_order, "delivery_lng", 0.0))
        ref_w = getattr(ref_order, "weight", 1.0)

        relatedness = []
        for other_id in served:
            other_order = orders_map.get(other_id)
            if not other_order:
                continue
            other_p = (getattr(other_order, "pickup_lat", 0.0), getattr(other_order, "pickup_lng", 0.0))
            other_d = (getattr(other_order, "delivery_lat", 0.0), getattr(other_order, "delivery_lng", 0.0))
            other_w = getattr(other_order, "weight", 1.0)

            dist_p = euclidean_distance(ref_p, other_p)
            dist_d = euclidean_distance(ref_d, other_d)
            w_diff = abs(ref_w - other_w)

            r_score = phi1 * (dist_p + dist_d) + phi2 * w_diff
            relatedness.append((other_id, r_score))

        # Sort ascending by relatedness score (smaller = more related)
        relatedness.sort(key=lambda x: x[1])

        # Randomized pick with power p
        rand_val = random.random() ** p
        idx = int(rand_val * len(relatedness))
        idx = min(idx, len(relatedness) - 1)

        chosen_id, _ = relatedness[idx]
        removed_orders.append(chosen_id)
        sol.remove_order(chosen_id)
        served.remove(chosen_id)

    return removed_orders, sol


def redundant_station_removal(solution: Solution) -> Tuple[List[int], Solution]:
    """
    d4: Redundant Station Removal
    Scans the route for swap stations.
    If removing a station leaves the route fully feasible, removes it to save detour & swap cost.
    """
    sol = solution.copy()
    i = 0
    while i < len(sol.stops):
        if sol.stops[i].stop_type == "swap_station":
            test_sol = sol.copy()
            test_sol.remove_station_at(i)
            if test_sol.is_feasible and test_sol.cost < sol.cost:
                sol = test_sol  # keep the improved solution without the redundant station
                continue  # check next at same index
        i += 1

    return [], sol
