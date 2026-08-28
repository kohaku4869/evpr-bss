import math
from typing import Dict, Optional, Tuple
from app.config import settings

EARTH_RADIUS_KM = 6371.0088
MATRIX_COORD_PRECISION = 5

# Process-local cache of real road distances (km) between point pairs, warmed by
# routing_service.build_and_warm_distance_matrix() before an ALNS run. Keeping this
# cache here (rather than in routing_service) lets calculate_leg_cost() stay a plain
# sync function used everywhere in core/alns without a circular import on
# routing_service (which already imports from this module).
_MATRIX_CACHE: Dict[Tuple[Tuple[float, float], Tuple[float, float]], float] = {}
_MATRIX_META: Dict[str, object] = {"source": "none", "point_count": 0}


def _round_point(p: Tuple[float, float]) -> Tuple[float, float]:
    return (round(p[0], MATRIX_COORD_PRECISION), round(p[1], MATRIX_COORD_PRECISION))


def clear_distance_matrix_cache() -> None:
    _MATRIX_CACHE.clear()
    _MATRIX_META["source"] = "none"
    _MATRIX_META["point_count"] = 0


def set_distance_matrix_entry(p1: Tuple[float, float], p2: Tuple[float, float], distance_km: float) -> None:
    _MATRIX_CACHE[(_round_point(p1), _round_point(p2))] = distance_km


def get_matrix_distance(p1: Tuple[float, float], p2: Tuple[float, float]) -> Optional[float]:
    return _MATRIX_CACHE.get((_round_point(p1), _round_point(p2)))


def set_distance_matrix_meta(source: str, point_count: int) -> None:
    _MATRIX_META["source"] = source
    _MATRIX_META["point_count"] = point_count


def get_distance_matrix_meta() -> Dict[str, object]:
    return dict(_MATRIX_META)


def euclidean_distance(p1: Tuple[float, float], p2: Tuple[float, float]) -> float:
    """Calculates 2D Euclidean distance between p1=(lat1, lng1) and p2=(lat2, lng2)."""
    return math.hypot(p1[0] - p2[0], p1[1] - p2[1])


def haversine_distance_km(p1: Tuple[float, float], p2: Tuple[float, float]) -> float:
    """Calculates great-circle distance in kilometers for lat/lng coordinates."""
    lat1, lng1 = math.radians(p1[0]), math.radians(p1[1])
    lat2, lng2 = math.radians(p2[0]), math.radians(p2[1])
    d_lat = lat2 - lat1
    d_lng = lng2 - lng1
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(d_lng / 2) ** 2
    )
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def energy_consumption(
    distance: float,
    current_load: float,
    base_rate: float = settings.BASE_CONSUMPTION_RATE,
    load_factor: float = settings.LOAD_CONSUMPTION_FACTOR
) -> float:
    """
    Computes energy consumption for a given leg distance in kilometers and vehicle load.
    e(l) = distance_km * (base_rate + load_factor * current_load)
    """
    return distance * (base_rate + load_factor * current_load)


def calculate_leg_cost(p1: Tuple[float, float], p2: Tuple[float, float]) -> float:
    """
    Travel cost is kilometers between lat/lng points.
    Prefers the real road-distance matrix warmed by routing_service before an ALNS
    run; falls back to haversine (straight-line) when a pair was never warmed
    (e.g. unit tests that construct costs directly without a matrix).
    """
    matrix_km = get_matrix_distance(p1, p2)
    if matrix_km is not None:
        return matrix_km
    return haversine_distance_km(p1, p2)


def delta_station_cost(
    u_coords: Tuple[float, float],
    f_coords: Tuple[float, float],
    v_coords: Tuple[float, float],
    cost_swap: float = settings.DEFAULT_SWAP_COST
) -> float:
    """
    Computes delta cost of inserting station f between stop u and stop v:
    DeltaCost = (c_u_f + c_f_v - c_u_v) + cost_swap
    """
    c_u_v = calculate_leg_cost(u_coords, v_coords)
    c_u_f = calculate_leg_cost(u_coords, f_coords)
    c_f_v = calculate_leg_cost(f_coords, v_coords)
    return (c_u_f + c_f_v - c_u_v) + cost_swap
