import json
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.core import cost as cost_module
from app.core.cost import haversine_distance_km
from app.models.routing_cache import RoutingCache

Coord = Tuple[float, float]  # lat, lng


@dataclass
class LegRoute:
    provider: str
    distance_km: float
    duration_seconds: float
    geometry: Dict[str, Any]


def _round_coord(coord: Coord) -> Coord:
    precision = settings.ROUTING_COORD_PRECISION
    return (round(coord[0], precision), round(coord[1], precision))


def route_cache_key(origin: Coord, destination: Coord, provider: str = "osrm") -> str:
    o_lat, o_lng = _round_coord(origin)
    d_lat, d_lng = _round_coord(destination)
    return f"{provider}:{o_lat},{o_lng}->{d_lat},{d_lng}"


def fallback_leg_route(origin: Coord, destination: Coord) -> LegRoute:
    distance_km = haversine_distance_km(origin, destination)
    # Urban fallback speed: 24 km/h = 150 seconds/km.
    duration_seconds = distance_km * 150.0
    geometry = {
        "type": "LineString",
        "coordinates": [
            [origin[1], origin[0]],
            [destination[1], destination[0]],
        ],
    }
    return LegRoute(
        provider="fallback_haversine",
        distance_km=distance_km,
        duration_seconds=duration_seconds,
        geometry=geometry,
    )


def _fetch_tomtom_leg(origin: Coord, destination: Coord) -> LegRoute:
    if not settings.TOMTOM_API_KEY:
        raise ValueError("TOMTOM_API_KEY is not configured")
    coords = f"{origin[0]},{origin[1]}:{destination[0]},{destination[1]}"
    url = f"https://api.tomtom.com/routing/1/calculateRoute/{coords}/json"
    params = {"key": settings.TOMTOM_API_KEY}
    with httpx.Client(timeout=settings.ROUTING_TIMEOUT_SECONDS) as client:
        response = client.get(url, params=params)
        response.raise_for_status()
    payload = response.json()
    routes = payload.get("routes") or []
    if not routes:
        raise ValueError("TomTom response did not contain a route")

    route = routes[0]
    summary = route.get("summary", {})
    distance_km = float(summary.get("lengthInMeters", 0)) / 1000.0
    duration_seconds = float(summary.get("travelTimeInSeconds", 0))

    legs = route.get("legs") or []
    points = legs[0].get("points") if legs else []
    # GeoJSON coordinates format: [lng, lat]
    coordinates = [[p["longitude"], p["latitude"]] for p in points]
    if not coordinates:
        coordinates = [[origin[1], origin[0]], [destination[1], destination[0]]]

    return LegRoute(
        provider="tomtom",
        distance_km=distance_km,
        duration_seconds=duration_seconds,
        geometry={"type": "LineString", "coordinates": coordinates},
    )


def _fetch_osrm_leg(origin: Coord, destination: Coord) -> LegRoute:
    coords = f"{origin[1]},{origin[0]};{destination[1]},{destination[0]}"
    url = f"{settings.OSRM_BASE_URL.rstrip('/')}/route/v1/driving/{coords}"
    params = {"overview": "full", "geometries": "geojson"}
    with httpx.Client(timeout=settings.ROUTING_TIMEOUT_SECONDS) as client:
        response = client.get(url, params=params)
        response.raise_for_status()
    payload = response.json()
    routes = payload.get("routes") or []
    if not routes:
        raise ValueError("OSRM response did not contain a route")

    route = routes[0]
    return LegRoute(
        provider="osrm",
        distance_km=float(route["distance"]) / 1000.0,
        duration_seconds=float(route["duration"]),
        geometry=route["geometry"],
    )


def get_leg_route(
    db: Optional[Session],
    origin: Coord,
    destination: Coord,
    prefer_provider: bool = True,
) -> LegRoute:
    key = route_cache_key(origin, destination, provider=settings.ROUTING_PROVIDER)
    if db is not None:
        cached = db.query(RoutingCache).filter(RoutingCache.cache_key == key).first()
        if cached:
            return LegRoute(
                provider=cached.provider,
                distance_km=cached.distance_km,
                duration_seconds=cached.duration_seconds,
                geometry=json.loads(cached.geometry_json),
            )

    leg = None
    if prefer_provider and settings.ROUTING_ENABLE_EXTERNAL:
        if settings.ROUTING_PROVIDER == "osrm":
            try:
                leg = _fetch_osrm_leg(origin, destination)
            except Exception:
                leg = None
            if leg is None and settings.TOMTOM_API_KEY:
                try:
                    leg = _fetch_tomtom_leg(origin, destination)
                except Exception:
                    leg = None
        else:
            # Default tomtom provider
            if settings.TOMTOM_API_KEY:
                try:
                    leg = _fetch_tomtom_leg(origin, destination)
                except Exception:
                    leg = None
            if leg is None:
                try:
                    leg = _fetch_osrm_leg(origin, destination)
                except Exception:
                    leg = None

    # 3. Fallback to Haversine
    if leg is None:
        leg = fallback_leg_route(origin, destination)

    if db is not None:
        rounded_origin = _round_coord(origin)
        rounded_dest = _round_coord(destination)
        db.add(
            RoutingCache(
                cache_key=key,
                provider=leg.provider,
                origin_lat=rounded_origin[0],
                origin_lng=rounded_origin[1],
                dest_lat=rounded_dest[0],
                dest_lng=rounded_dest[1],
                distance_km=leg.distance_km,
                duration_seconds=leg.duration_seconds,
                geometry_json=json.dumps(leg.geometry),
            )
        )
        db.flush()

    return leg


def _fetch_osrm_table(points: List[Coord]) -> Tuple[List[List[Optional[float]]], List[List[Optional[float]]]]:
    """
    Calls OSRM's Table Service once to get the full NxN distance/duration matrix
    for `points`, instead of issuing N*(N-1) individual /route requests. Raises on
    any failure so the caller can fall back to Haversine for the whole matrix.
    """
    coords_param = ";".join(f"{lng},{lat}" for lat, lng in points)
    url = f"{settings.OSRM_BASE_URL.rstrip('/')}/table/v1/driving/{coords_param}"
    params = {"annotations": "distance,duration"}
    with httpx.Client(timeout=settings.ROUTING_TIMEOUT_SECONDS * 3) as client:
        response = client.get(url, params=params)
        response.raise_for_status()
    payload = response.json()
    if payload.get("code") != "Ok":
        raise ValueError(f"OSRM table response code={payload.get('code')}")

    distances = payload.get("distances")
    durations = payload.get("durations")
    if not distances:
        raise ValueError("OSRM table response missing distances")
    return distances, durations or []


def build_and_warm_distance_matrix(points: List[Coord]) -> Dict[str, Any]:
    """
    Fetches real road distances between every pair of `points` (depot, order
    pickups/deliveries, BSS stations) in one bulk request and warms the
    process-local matrix cache in app.core.cost, so all subsequent ALNS cost/
    feasibility calculations (and the reactive local patch) reason about real
    road km instead of straight-line distance.

    Falls back to Haversine for the whole matrix if the routing provider fails,
    marking the result source as "fallback_haversine".
    """
    unique_points: List[Coord] = []
    seen = set()
    for p in points:
        key = (round(p[0], settings.ROUTING_COORD_PRECISION), round(p[1], settings.ROUTING_COORD_PRECISION))
        if key not in seen:
            seen.add(key)
            unique_points.append(p)

    cost_module.clear_distance_matrix_cache()

    if len(unique_points) < 2:
        cost_module.set_distance_matrix_meta("none", len(unique_points))
        return {"source": "none", "point_count": len(unique_points), "pairs": 0}

    source = "osrm_table"
    try:
        if not settings.ROUTING_ENABLE_EXTERNAL:
            raise RuntimeError("External routing disabled by config")
        distances, _durations = _fetch_osrm_table(unique_points)
        for i, origin in enumerate(unique_points):
            for j, dest in enumerate(unique_points):
                if i == j:
                    continue
                raw = distances[i][j] if i < len(distances) and j < len(distances[i]) else None
                distance_km = (raw / 1000.0) if raw is not None else haversine_distance_km(origin, dest)
                cost_module.set_distance_matrix_entry(origin, dest, distance_km)
    except Exception:
        source = "fallback_haversine"
        for origin in unique_points:
            for dest in unique_points:
                if origin == dest:
                    continue
                cost_module.set_distance_matrix_entry(origin, dest, haversine_distance_km(origin, dest))

    pair_count = len(unique_points) * (len(unique_points) - 1)
    cost_module.set_distance_matrix_meta(source, len(unique_points))
    return {"source": source, "point_count": len(unique_points), "pairs": pair_count}


def build_route_segments(db: Optional[Session], stops: List[Any]) -> Dict[str, Any]:
    segments: List[Dict[str, Any]] = []
    total_distance_km = 0.0
    total_duration_seconds = 0.0
    providers = set()
    features = []

    for idx in range(len(stops) - 1):
        origin = (float(stops[idx].lat), float(stops[idx].lng))
        destination = (float(stops[idx + 1].lat), float(stops[idx + 1].lng))
        leg = get_leg_route(db, origin, destination)
        total_distance_km += leg.distance_km
        total_duration_seconds += leg.duration_seconds
        providers.add(leg.provider)

        segment = {
            "from_sequence_index": idx,
            "to_sequence_index": idx + 1,
            "distance_km": round(leg.distance_km, 3),
            "duration_seconds": round(leg.duration_seconds, 1),
            "geometry_source": leg.provider,
            "geometry": leg.geometry,
        }
        segments.append(segment)
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "from_sequence_index": idx,
                    "to_sequence_index": idx + 1,
                    "geometry_source": leg.provider,
                },
                "geometry": leg.geometry,
            }
        )

    if not providers:
        geometry_source = "none"
    elif "tomtom" in providers and len(providers) == 1:
        geometry_source = "tomtom"
    elif "osrm" in providers and len(providers) == 1:
        geometry_source = "osrm"
    elif "fallback_haversine" in providers and len(providers) == 1:
        geometry_source = "fallback_haversine"
    else:
        geometry_source = "mixed"

    return {
        "segments": segments,
        "total_distance_km": round(total_distance_km, 3),
        "total_duration_seconds": round(total_duration_seconds, 1),
        "geometry_source": geometry_source,
        "geometry": {
            "type": "FeatureCollection",
            "features": features,
        },
    }
