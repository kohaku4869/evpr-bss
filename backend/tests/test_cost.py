import pytest
from app.core.cost import (
    euclidean_distance,
    energy_consumption,
    calculate_leg_cost,
    delta_station_cost,
    haversine_distance_km,
)


def test_euclidean_distance():
    p1 = (0.0, 0.0)
    p2 = (3.0, 4.0)
    assert euclidean_distance(p1, p2) == pytest.approx(5.0)


def test_energy_consumption():
    dist = 10.0
    load = 20.0
    base_rate = 0.4
    load_factor = 0.01
    # expected: 10 * (0.4 + 0.01 * 20) = 10 * 0.6 = 6.0
    energy = energy_consumption(dist, load, base_rate, load_factor)
    assert energy == pytest.approx(6.0)


def test_calculate_leg_cost_uses_haversine_km():
    # calculate_leg_cost must be real-world km distance, not raw coordinate degrees.
    p1 = (21.0285, 105.8542)  # Hoan Kiem, Hanoi
    p2 = (21.0365, 105.7909)  # Cau Giay, Hanoi
    assert calculate_leg_cost(p1, p2) == pytest.approx(haversine_distance_km(p1, p2))
    # Sanity: real distance between these two points is a few km, not ~0.06 (raw degree delta).
    assert 5.0 < calculate_leg_cost(p1, p2) < 10.0


def test_delta_station_cost():
    u = (21.0, 105.80)
    v = (21.0, 105.90)
    f = (21.05, 105.85)
    cost_swap = 5.0
    delta = delta_station_cost(u, f, v, cost_swap)
    expected = (
        haversine_distance_km(u, f) + haversine_distance_km(f, v) - haversine_distance_km(u, v)
    ) + cost_swap
    assert delta == pytest.approx(expected)
