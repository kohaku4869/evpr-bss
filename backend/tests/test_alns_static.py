import pytest
from app.core.feasibility import Stop, check_feasibility_and_cost
from app.core.alns.solution import Solution
from app.core.alns.destroy_operators import (
    random_pair_removal,
    worst_cost_pair_removal,
    shaw_pair_removal,
    redundant_station_removal
)
from app.core.alns.repair_operators import greedy_insertion, regret_k_insertion
from app.core.alns.alns_runner import ALNSRunner


# Test fixtures use real-world-scale lat/lng (degrees) since cost.py now computes
# haversine distance in km. Values below map the original 0..100 abstract grid onto a
# small real area (~5km across) around Hanoi via SCALE, preserving relative topology
# while keeping leg distances small enough to be feasible under production battery
# settings (BATTERY_CAPACITY_B=40, BASE_CONSUMPTION_RATE=2.2 energy/km).
SCALE = 0.0005
BASE_LAT = 21.0
BASE_LNG = 105.8


def geo(lat_units: float, lng_units: float) -> tuple:
    return (BASE_LAT + lat_units * SCALE, BASE_LNG + lng_units * SCALE)


@pytest.fixture
def sample_data():
    stations = [
        {"id": 1, "name": "BSS Alpha", "lat": geo(75.0, 50.0)[0], "lng": geo(75.0, 50.0)[1], "is_available": True, "cost_swap": 5.0},
        {"id": 2, "name": "BSS Beta", "lat": geo(50.0, 80.0)[0], "lng": geo(50.0, 80.0)[1], "is_available": True, "cost_swap": 5.0},
        {"id": 3, "name": "BSS Gamma", "lat": geo(30.0, 75.0)[0], "lng": geo(30.0, 75.0)[1], "is_available": True, "cost_swap": 6.0},
        {"id": 4, "name": "BSS Delta", "lat": geo(25.0, 55.0)[0], "lng": geo(25.0, 55.0)[1], "is_available": True, "cost_swap": 5.0},
        {"id": 5, "name": "BSS Epsilon", "lat": geo(50.0, 20.0)[0], "lng": geo(50.0, 20.0)[1], "is_available": True, "cost_swap": 5.0},
    ]
    orders = [
        {"id": 1, "pickup_lat": geo(60.0, 55.0)[0], "pickup_lng": geo(60.0, 55.0)[1], "delivery_lat": geo(80.0, 60.0)[0], "delivery_lng": geo(80.0, 60.0)[1], "weight": 8.0},
        {"id": 2, "pickup_lat": geo(85.0, 45.0)[0], "pickup_lng": geo(85.0, 45.0)[1], "delivery_lat": geo(70.0, 75.0)[0], "delivery_lng": geo(70.0, 75.0)[1], "weight": 12.0},
        {"id": 3, "pickup_lat": geo(45.0, 85.0)[0], "pickup_lng": geo(45.0, 85.0)[1], "delivery_lat": geo(30.0, 80.0)[0], "delivery_lng": geo(30.0, 80.0)[1], "weight": 10.0},
        {"id": 4, "pickup_lat": geo(20.0, 70.0)[0], "pickup_lng": geo(20.0, 70.0)[1], "delivery_lat": geo(15.0, 50.0)[0], "delivery_lng": geo(15.0, 50.0)[1], "weight": 15.0},
    ]
    return orders, stations


def test_initial_solution_construction(sample_data):
    orders, stations = sample_data
    runner = ALNSRunner(orders, stations, depot_lat=geo(50.0, 50.0)[0], depot_lng=geo(50.0, 50.0)[1], random_seed=42)
    init_sol = runner.construct_initial_solution()

    assert init_sol.is_feasible is True
    assert len(init_sol.unassigned_orders) == 0
    assert init_sol.get_served_orders() == {1, 2, 3, 4}


def test_destroy_and_repair_operators(sample_data):
    orders, stations = sample_data
    runner = ALNSRunner(orders, stations, depot_lat=geo(50.0, 50.0)[0], depot_lng=geo(50.0, 50.0)[1], random_seed=42)
    sol = runner.construct_initial_solution()

    # 1. Test random pair removal
    removed, partial = random_pair_removal(sol, q=2)
    assert len(removed) == 2
    assert len(partial.get_served_orders()) == 2

    # 2. Test greedy repair
    repaired_greedy = greedy_insertion(partial, removed)
    assert repaired_greedy.is_feasible is True
    assert repaired_greedy.get_served_orders() == {1, 2, 3, 4}

    # 3. Test regret-2 repair
    removed2, partial2 = worst_cost_pair_removal(sol, q=2)
    repaired_regret = regret_k_insertion(partial2, removed2, k=2)
    assert repaired_regret.is_feasible is True
    assert repaired_regret.get_served_orders() == {1, 2, 3, 4}


def test_redundant_station_removal():
    # If a station is not needed for battery feasibility, redundant_station_removal removes it
    stations_map = {1: {"id": 1, "name": "BSS 1", "is_available": True, "cost_swap": 5.0}}
    # Short hops (~0.1km apart) so the swap station is never needed for battery feasibility.
    stops = [
        Stop(stop_type="depot", lat=21.000, lng=105.800),
        Stop(stop_type="pickup", lat=21.001, lng=105.800, ref_order_id=1, weight=5.0),
        Stop(stop_type="swap_station", lat=21.0015, lng=105.800, ref_station_id=1),  # Unnecessary station!
        Stop(stop_type="delivery", lat=21.002, lng=105.800, ref_order_id=1, weight=5.0),
    ]
    sol = Solution(stops=stops, stations_map=stations_map)
    assert any(s.stop_type == "swap_station" for s in sol.stops)

    _, optimized = redundant_station_removal(sol)
    assert not any(s.stop_type == "swap_station" for s in optimized.stops)
    assert optimized.cost < sol.cost


def test_alns_runner_optimizes_route(sample_data):
    orders, stations = sample_data
    runner = ALNSRunner(orders, stations, depot_lat=geo(50.0, 50.0)[0], depot_lng=geo(50.0, 50.0)[1], random_seed=42)
    best_sol = runner.run(max_iterations=50, time_limit_seconds=3.0)

    assert best_sol.is_feasible is True
    assert len(best_sol.unassigned_orders) == 0
    assert best_sol.get_served_orders() == {1, 2, 3, 4}
    # Check precedence
    stops = best_sol.stops
    for o_id in [1, 2, 3, 4]:
        p_idx = next(i for i, s in enumerate(stops) if s.stop_type == "pickup" and s.ref_order_id == o_id)
        d_idx = next(i for i, s in enumerate(stops) if s.stop_type == "delivery" and s.ref_order_id == o_id)
        assert p_idx < d_idx
