import pytest
from app.core.feasibility import Stop, check_feasibility_and_cost
from app.core.cost import haversine_distance_km

# check_feasibility_and_cost computes leg distances via haversine (real km), so test
# fixtures use small real lat/lng offsets (~0.01 deg ~= 1.1km) instead of arbitrary
# large "plane" coordinates, to keep energy/battery numbers realistic.


def test_feasible_route():
    stops = [
        Stop(stop_type="depot", lat=21.00, lng=105.80, label="Depot"),
        Stop(stop_type="pickup", lat=21.01, lng=105.80, ref_order_id=1, weight=10.0, label="Pickup 1"),
        Stop(stop_type="delivery", lat=21.02, lng=105.80, ref_order_id=1, weight=10.0, label="Delivery 1"),
    ]
    eval_res = check_feasibility_and_cost(stops, capacity=50.0, battery_max=100.0, base_rate=0.5, load_factor=0.01)
    expected_distance = haversine_distance_km((21.00, 105.80), (21.01, 105.80)) + haversine_distance_km(
        (21.01, 105.80), (21.02, 105.80)
    )
    assert eval_res.is_feasible is True
    assert eval_res.total_distance == pytest.approx(expected_distance)
    assert eval_res.step_loads == [0.0, 10.0, 0.0]


def test_precedence_violation_delivery_before_pickup():
    stops = [
        Stop(stop_type="depot", lat=21.00, lng=105.80),
        Stop(stop_type="delivery", lat=21.01, lng=105.80, ref_order_id=1, weight=10.0),
        Stop(stop_type="pickup", lat=21.02, lng=105.80, ref_order_id=1, weight=10.0),
    ]
    eval_res = check_feasibility_and_cost(stops, capacity=50.0, battery_max=100.0)
    assert eval_res.is_feasible is False
    assert "without pickup" in eval_res.reason or "Delivery before pickup" in eval_res.reason


def test_capacity_overload_violation():
    stops = [
        Stop(stop_type="depot", lat=21.00, lng=105.80),
        Stop(stop_type="pickup", lat=21.01, lng=105.80, ref_order_id=1, weight=35.0),
        Stop(stop_type="pickup", lat=21.02, lng=105.80, ref_order_id=2, weight=20.0),  # total 55 > 50
        Stop(stop_type="delivery", lat=21.03, lng=105.80, ref_order_id=1, weight=35.0),
        Stop(stop_type="delivery", lat=21.04, lng=105.80, ref_order_id=2, weight=20.0),
    ]
    # battery_max set high to isolate the capacity check from battery limits.
    eval_res = check_feasibility_and_cost(stops, capacity=50.0, battery_max=10000.0)
    assert eval_res.is_feasible is False
    assert "Vehicle overloaded" in eval_res.reason


def test_battery_depletion_violation():
    stops = [
        Stop(stop_type="depot", lat=0.0, lng=0.0),
        Stop(stop_type="pickup", lat=100.0, lng=0.0, ref_order_id=1, weight=5.0),
        Stop(stop_type="delivery", lat=200.0, lng=0.0, ref_order_id=1, weight=5.0),
    ]
    # Total distance 200, energy consumed ~100+ > battery 50
    eval_res = check_feasibility_and_cost(stops, capacity=50.0, battery_max=50.0, base_rate=0.5, load_factor=0.0)
    assert eval_res.is_feasible is False
    assert "Battery depleted" in eval_res.reason


def test_swap_station_replenishes_battery():
    stations_map = {1: {"id": 1, "name": "BSS 1", "is_available": True, "cost_swap": 5.0}}
    # depot -> pickup -> swap_station -> delivery, each leg ~1.1km (0.01 deg).
    stops = [
        Stop(stop_type="depot", lat=21.00, lng=105.80),
        Stop(stop_type="pickup", lat=21.01, lng=105.80, ref_order_id=1, weight=0.0),
        Stop(stop_type="swap_station", lat=21.02, lng=105.80, ref_station_id=1),
        Stop(stop_type="delivery", lat=21.03, lng=105.80, ref_order_id=1, weight=0.0),
    ]
    leg_km = haversine_distance_km((21.00, 105.80), (21.01, 105.80))
    expected_distance = 3 * leg_km
    # battery_max just enough for two legs (~2*leg_km*base_rate) between swaps.
    base_rate = 0.5
    battery_max = 2 * leg_km * base_rate + 1.0
    eval_res = check_feasibility_and_cost(
        stops, stations_map=stations_map, capacity=50.0, battery_max=battery_max, base_rate=base_rate, load_factor=0.0
    )
    assert eval_res.is_feasible is True
    assert eval_res.total_distance == pytest.approx(expected_distance)
    assert eval_res.total_swap_cost == pytest.approx(5.0)
    assert eval_res.total_cost == pytest.approx(expected_distance + 5.0)


def test_unavailable_swap_station_rejected():
    stations_map = {1: {"id": 1, "name": "BSS 1", "is_available": False, "cost_swap": 5.0}}
    stops = [
        Stop(stop_type="depot", lat=21.00, lng=105.80),
        Stop(stop_type="swap_station", lat=21.01, lng=105.80, ref_station_id=1),
    ]
    # Large battery_max isolates the availability check from battery depletion.
    eval_res = check_feasibility_and_cost(stops, stations_map=stations_map, battery_max=10000.0)
    assert eval_res.is_feasible is False
    assert "unavailable" in eval_res.reason
