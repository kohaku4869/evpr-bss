import pytest
from app.core.feasibility import Stop, check_feasibility_and_cost
from app.core.reactive.local_patch import apply_local_patch

# Coordinates below map the original 0..100 abstract grid onto a small real area
# (~5km across) around Hanoi via SCALE, so haversine-based costs stay feasible
# under production battery settings while preserving the original relative topology.
SCALE = 0.0005
BASE_LAT = 21.0
BASE_LNG = 105.8


def geo(lat_units: float, lng_units: float) -> tuple:
    return (BASE_LAT + lat_units * SCALE, BASE_LNG + lng_units * SCALE)


@pytest.fixture
def stations_map():
    return {
        1: {"id": 1, "name": "BSS Alpha", "lat": geo(75.0, 50.0)[0], "lng": geo(75.0, 50.0)[1], "is_available": True, "cost_swap": 5.0},
        2: {"id": 2, "name": "BSS Beta", "lat": geo(50.0, 80.0)[0], "lng": geo(50.0, 80.0)[1], "is_available": True, "cost_swap": 5.0},
        3: {"id": 3, "name": "BSS Gamma", "lat": geo(30.0, 75.0)[0], "lng": geo(30.0, 75.0)[1], "is_available": True, "cost_swap": 6.0},
        4: {"id": 4, "name": "BSS Delta", "lat": geo(28.0, 70.0)[0], "lng": geo(28.0, 70.0)[1], "is_available": True, "cost_swap": 5.0},  # Close alternative to Gamma
        5: {"id": 5, "name": "BSS Epsilon", "lat": geo(50.0, 20.0)[0], "lng": geo(50.0, 20.0)[1], "is_available": True, "cost_swap": 5.0},
    }


def test_reactive_patch_success(stations_map):
    # Route with Station 3 in Mutable Suffix (status="pending")
    stops = [
        Stop(stop_type="depot", lat=geo(50.0, 50.0)[0], lng=geo(50.0, 50.0)[1], status="done", label="Depot"),
        Stop(stop_type="pickup", lat=geo(60.0, 55.0)[0], lng=geo(60.0, 55.0)[1], ref_order_id=1, weight=10.0, status="done", label="Pickup 1"),
        Stop(stop_type="swap_station", lat=geo(30.0, 75.0)[0], lng=geo(30.0, 75.0)[1], ref_station_id=3, status="pending", label="BSS Gamma"),
        Stop(stop_type="delivery", lat=geo(25.0, 70.0)[0], lng=geo(25.0, 70.0)[1], ref_order_id=1, weight=10.0, status="pending", label="Delivery 1"),
    ]

    # Station 3 goes DOWN!
    res = apply_local_patch(stops, failed_station_id=3, stations_map=stations_map)

    assert res.success is True
    assert res.old_station["station_id"] == 3
    assert res.new_station["station_id"] == 4  # Replaced with Station 4 (Delta)
    assert res.latency_ms < 1500.0  # USP latency < 1.5s requirement

    # Check that frozen prefix (stops 0 and 1) were NOT modified
    assert res.updated_stops[0].stop_type == "depot"
    assert res.updated_stops[0].status == "done"
    assert res.updated_stops[1].stop_type == "pickup"
    assert res.updated_stops[1].status == "done"

    # Check that stop 2 was replaced with station 4
    assert res.updated_stops[2].stop_type == "swap_station"
    assert res.updated_stops[2].ref_station_id == 4


def test_station_in_frozen_prefix_ignored(stations_map):
    # Route where Station 3 is ALREADY COMPLETED (status="done")
    stops = [
        Stop(stop_type="depot", lat=50.0, lng=50.0, status="done"),
        Stop(stop_type="swap_station", lat=30.0, lng=75.0, ref_station_id=3, status="done"),
        Stop(stop_type="pickup", lat=60.0, lng=55.0, ref_order_id=1, weight=10.0, status="pending"),
    ]

    res = apply_local_patch(stops, failed_station_id=3, stations_map=stations_map)
    assert res.success is False
    assert "Frozen Prefix" in res.reason


def test_unrelated_station_ignored(stations_map):
    # Route that does NOT contain Station 5
    stops = [
        Stop(stop_type="depot", lat=50.0, lng=50.0, status="done"),
        Stop(stop_type="pickup", lat=60.0, lng=55.0, ref_order_id=1, weight=10.0, status="pending"),
    ]

    res = apply_local_patch(stops, failed_station_id=5, stations_map=stations_map)
    assert res.success is False
    assert "not in the active route" in res.reason


def test_no_feasible_replacement_preserves_route():
    # If all other stations are unavailable
    stations_map_all_down = {
        1: {"id": 1, "name": "BSS 1", "lat": 10.0, "lng": 10.0, "is_available": False, "cost_swap": 5.0},
        2: {"id": 2, "name": "BSS 2", "lat": 20.0, "lng": 20.0, "is_available": False, "cost_swap": 5.0},
    }
    stops = [
        Stop(stop_type="depot", lat=0.0, lng=0.0, status="done"),
        Stop(stop_type="swap_station", lat=10.0, lng=10.0, ref_station_id=1, status="pending"),
        Stop(stop_type="delivery", lat=100.0, lng=100.0, ref_order_id=1, weight=0.0, status="pending"),
    ]

    res = apply_local_patch(stops, failed_station_id=1, stations_map=stations_map_all_down)
    assert res.success is False
    assert "No feasible" in res.reason
    # Ensure original stops list is not corrupted
    assert len(res.updated_stops) == len(stops)
