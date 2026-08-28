import pytest

from app.config import settings
from app.core import cost as cost_module
from app.core.cost import haversine_distance_km
from app.db.database import Base, engine, SessionLocal
from app.models.routing_cache import RoutingCache
from app.services import routing_service


@pytest.fixture(autouse=True)
def setup_routing_cache_table():
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        db.query(RoutingCache).delete()
        db.commit()
    yield
    with SessionLocal() as db:
        db.query(RoutingCache).delete()
        db.commit()


def test_cache_hit_avoids_second_provider_call(monkeypatch):
    monkeypatch.setattr(settings, "ROUTING_ENABLE_EXTERNAL", True)
    monkeypatch.setattr(settings, "ROUTING_PROVIDER", "osrm")
    monkeypatch.setattr(settings, "TOMTOM_API_KEY", "")

    call_count = {"n": 0}

    def fake_fetch(origin, destination):
        call_count["n"] += 1
        return routing_service.LegRoute(
            provider="osrm",
            distance_km=3.2,
            duration_seconds=480.0,
            geometry={"type": "LineString", "coordinates": [[origin[1], origin[0]], [destination[1], destination[0]]]},
        )

    monkeypatch.setattr(routing_service, "_fetch_osrm_leg", fake_fetch)

    origin = (21.0285, 105.8542)
    destination = (21.0365, 105.7909)

    with SessionLocal() as db:
        first = routing_service.get_leg_route(db, origin, destination)
        db.commit()
        second = routing_service.get_leg_route(db, origin, destination)
        db.commit()

    assert call_count["n"] == 1
    assert first.provider == "osrm"
    assert second.provider == "osrm"
    assert second.distance_km == pytest.approx(first.distance_km)
    assert second.duration_seconds == pytest.approx(first.duration_seconds)


def test_osrm_response_parser_converts_geometry(monkeypatch):
    payload = {
        "routes": [
            {
                "distance": 4200.0,  # meters
                "duration": 630.0,  # seconds
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[105.8542, 21.0285], [105.8400, 21.0300], [105.7909, 21.0365]],
                },
            }
        ]
    }

    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return payload

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def get(self, url, params=None):
            return FakeResponse()

    monkeypatch.setattr(routing_service.httpx, "Client", FakeClient)

    origin = (21.0285, 105.8542)
    destination = (21.0365, 105.7909)
    leg = routing_service._fetch_osrm_leg(origin, destination)

    assert leg.provider == "osrm"
    assert leg.distance_km == pytest.approx(4.2)
    assert leg.duration_seconds == pytest.approx(630.0)
    # geometry coordinates must be preserved verbatim as [lng, lat] pairs from OSRM.
    assert leg.geometry["coordinates"] == payload["routes"][0]["geometry"]["coordinates"]


def test_fallback_haversine_used_on_provider_error(monkeypatch):
    monkeypatch.setattr(settings, "ROUTING_ENABLE_EXTERNAL", True)
    monkeypatch.setattr(settings, "ROUTING_PROVIDER", "osrm")
    monkeypatch.setattr(settings, "TOMTOM_API_KEY", "")

    def failing_fetch(origin, destination):
        raise TimeoutError("provider unavailable")

    monkeypatch.setattr(routing_service, "_fetch_osrm_leg", failing_fetch)

    origin = (21.0285, 105.8542)
    destination = (21.0365, 105.7909)

    with SessionLocal() as db:
        leg = routing_service.get_leg_route(db, origin, destination)
        db.commit()

    assert leg.provider == "fallback_haversine"
    assert leg.distance_km == pytest.approx(haversine_distance_km(origin, destination))


def test_external_disabled_uses_fallback_directly(monkeypatch):
    monkeypatch.setattr(settings, "ROUTING_ENABLE_EXTERNAL", False)

    call_count = {"n": 0}

    def should_not_be_called(origin, destination):
        call_count["n"] += 1
        raise AssertionError("OSRM should not be called when ROUTING_ENABLE_EXTERNAL is False")

    monkeypatch.setattr(routing_service, "_fetch_osrm_leg", should_not_be_called)

    origin = (21.0, 105.8)
    destination = (21.05, 105.85)
    leg = routing_service.get_leg_route(None, origin, destination)

    assert call_count["n"] == 0
    assert leg.provider == "fallback_haversine"
    assert leg.distance_km == pytest.approx(haversine_distance_km(origin, destination))


def test_build_route_segments_total_matches_sum_of_legs(monkeypatch):
    monkeypatch.setattr(settings, "ROUTING_ENABLE_EXTERNAL", False)

    class StubStop:
        def __init__(self, lat, lng):
            self.lat = lat
            self.lng = lng

    stops = [
        StubStop(21.0285, 105.8542),
        StubStop(21.0365, 105.7909),
        StubStop(20.9954, 105.8072),
    ]

    with SessionLocal() as db:
        result = routing_service.build_route_segments(db, stops)
        db.commit()

    assert len(result["segments"]) == 2
    summed = sum(seg["distance_km"] for seg in result["segments"])
    assert result["total_distance_km"] == pytest.approx(summed, abs=0.01)
    assert result["geometry"]["type"] == "FeatureCollection"
    assert len(result["geometry"]["features"]) == 2
    assert result["geometry_source"] == "fallback_haversine"


def test_tomtom_response_parser_converts_geometry(monkeypatch):
    monkeypatch.setattr(settings, "TOMTOM_API_KEY", "dummy_key")
    payload = {
        "routes": [
            {
                "summary": {
                    "lengthInMeters": 5100,
                    "travelTimeInSeconds": 720,
                },
                "legs": [
                    {
                        "points": [
                            {"latitude": 21.0285, "longitude": 105.8542},
                            {"latitude": 21.0365, "longitude": 105.7909},
                        ]
                    }
                ],
            }
        ]
    }

    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return payload

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def get(self, url, params=None):
            return FakeResponse()

    monkeypatch.setattr(routing_service.httpx, "Client", FakeClient)

    origin = (21.0285, 105.8542)
    destination = (21.0365, 105.7909)
    leg = routing_service._fetch_tomtom_leg(origin, destination)

    assert leg.provider == "tomtom"
    assert leg.distance_km == pytest.approx(5.1)
    assert leg.duration_seconds == pytest.approx(720.0)
    assert leg.geometry["coordinates"] == [[105.8542, 21.0285], [105.7909, 21.0365]]


def test_build_and_warm_distance_matrix_uses_osrm_table(monkeypatch):
    monkeypatch.setattr(settings, "ROUTING_ENABLE_EXTERNAL", True)

    points = [
        (21.0285, 105.8542),  # depot
        (21.0365, 105.7909),  # station
        (20.9954, 105.8072),  # order pickup
    ]

    # Table distances (meters) deliberately differ from Haversine to prove the
    # matrix cache -- not straight-line distance -- is what calculate_leg_cost sees.
    fake_distances = [
        [0.0, 9000.0, 12000.0],
        [9500.0, 0.0, 7000.0],
        [12500.0, 7200.0, 0.0],
    ]

    def fake_fetch_table(pts):
        assert pts == points
        return fake_distances, []

    monkeypatch.setattr(routing_service, "_fetch_osrm_table", fake_fetch_table)

    result = routing_service.build_and_warm_distance_matrix(points)

    assert result["source"] == "osrm_table"
    assert result["point_count"] == 3
    assert result["pairs"] == 6

    # calculate_leg_cost must now return the warmed table distance, not haversine.
    assert cost_module.calculate_leg_cost(points[0], points[1]) == pytest.approx(9.0)
    assert cost_module.calculate_leg_cost(points[1], points[0]) == pytest.approx(9.5)
    assert cost_module.calculate_leg_cost(points[1], points[2]) == pytest.approx(7.0)
    assert cost_module.get_distance_matrix_meta()["source"] == "osrm_table"


def test_build_and_warm_distance_matrix_falls_back_to_haversine(monkeypatch):
    monkeypatch.setattr(settings, "ROUTING_ENABLE_EXTERNAL", True)

    def failing_fetch_table(pts):
        raise TimeoutError("OSRM table endpoint unavailable")

    monkeypatch.setattr(routing_service, "_fetch_osrm_table", failing_fetch_table)

    points = [
        (21.0285, 105.8542),
        (21.0365, 105.7909),
    ]
    result = routing_service.build_and_warm_distance_matrix(points)

    assert result["source"] == "fallback_haversine"
    assert cost_module.calculate_leg_cost(points[0], points[1]) == pytest.approx(
        haversine_distance_km(points[0], points[1])
    )


def test_build_and_warm_distance_matrix_deduplicates_points(monkeypatch):
    monkeypatch.setattr(settings, "ROUTING_ENABLE_EXTERNAL", True)

    call_args = {}

    def fake_fetch_table(pts):
        call_args["points"] = pts
        n = len(pts)
        return [[0.0 if i == j else 1000.0 for j in range(n)] for i in range(n)], []

    monkeypatch.setattr(routing_service, "_fetch_osrm_table", fake_fetch_table)

    points = [
        (21.0285, 105.8542),
        (21.0285, 105.8542),  # exact duplicate
        (21.0365, 105.7909),
    ]
    result = routing_service.build_and_warm_distance_matrix(points)

    assert result["point_count"] == 2
    assert len(call_args["points"]) == 2

