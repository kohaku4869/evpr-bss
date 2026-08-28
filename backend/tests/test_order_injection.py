import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.db.database import SessionLocal, Base, engine
from app.db.init_db import seed_demo_data
from app.models.route import Route
from app.models.route_stop import RouteStop
from app.services.route_service import handle_new_order_event


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_demo_data(db)
    yield


async def _optimize():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/plan/optimize", json={"shipper_id": 1})
        assert res.status_code == 200
        return res.json()


@pytest.mark.asyncio
async def test_inject_order_preserves_frozen_prefix_and_extends_suffix():
    route = await _optimize()
    route_id = route["id"]

    # Complete the first stop (depot -> pickup) so the route has a real frozen prefix.
    first_pending = next(s for s in route["stops"] if s["status"] == "pending")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(f"/routes/{route_id}/stop/{first_pending['id']}/complete")
        assert res.status_code == 200
        route_after_complete = res.json()

    frozen_ids_before = [s["id"] for s in route_after_complete["stops"] if s["status"] == "done"]
    frozen_sequence_before = [
        (s["stop_type"], s["ref_order_id"], s["ref_station_id"])
        for s in route_after_complete["stops"]
        if s["status"] == "done"
    ]

    result = await handle_new_order_event(shipper_id=1)
    assert result["success"] is True

    with SessionLocal() as db:
        updated_route = db.query(Route).filter(Route.id == route_id).first()
        stops = (
            db.query(RouteStop)
            .filter(RouteStop.route_id == route_id)
            .order_by(RouteStop.sequence_index)
            .all()
        )

    done_stops = [s for s in stops if s.status == "done"]
    frozen_sequence_after = [(s.stop_type, s.ref_order_id, s.ref_station_id) for s in done_stops]

    # Frozen prefix must be untouched: same stops, same order, same statuses.
    assert frozen_sequence_after == frozen_sequence_before

    # The new order must appear somewhere in the (now longer) pending suffix.
    new_order_id = result["order_id"]
    pending_order_ids = {s.ref_order_id for s in stops if s.status == "pending" and s.stop_type in ("pickup", "delivery")}
    assert new_order_id in pending_order_ids

    # Route total cost must be updated and route stays active.
    assert updated_route.status == "active"
    assert updated_route.total_cost == pytest.approx(result["total_cost"], abs=0.01)


@pytest.mark.asyncio
async def test_inject_order_endpoint_returns_patch_result():
    await _optimize()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/orders/inject")
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert "order_id" in data
        assert data["latency_ms"] >= 0
