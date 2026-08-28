import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db.database import SessionLocal, Base, engine
from app.db.init_db import seed_demo_data


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_demo_data(db)
    yield


@pytest.mark.asyncio
async def test_api_orders():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Get orders
        res = await ac.get("/orders")
        assert res.status_code == 200
        orders = res.json()
        assert len(orders) >= 6

        # 2. Create order
        new_order = {
            "pickup_lat": 10.0,
            "pickup_lng": 10.0,
            "delivery_lat": 20.0,
            "delivery_lng": 20.0,
            "weight": 5.0
        }
        res_post = await ac.post("/orders", json=new_order)
        assert res_post.status_code == 201
        created = res_post.json()
        assert created["weight"] == 5.0


@pytest.mark.asyncio
async def test_api_stations_and_status_patch():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Get stations
        res = await ac.get("/stations")
        assert res.status_code == 200
        stations = res.json()
        assert len(stations) >= 5

        # 2. Patch station status
        st_id = stations[0]["id"]
        res_patch = await ac.patch(f"/stations/{st_id}/status", json={"is_available": False})
        assert res_patch.status_code == 200
        updated = res_patch.json()
        assert updated["is_available"] is False


@pytest.mark.asyncio
async def test_api_optimize_and_complete_stop():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Run optimization
        res_opt = await ac.post("/plan/optimize", json={"shipper_id": 1})
        assert res_opt.status_code == 200
        route = res_opt.json()
        assert route["shipper_id"] == 1
        assert len(route["stops"]) > 0

        # Route geometry: total distance/duration must equal the sum of segment legs,
        # and there must be exactly one segment per consecutive stop pair.
        assert len(route["segments"]) == len(route["stops"]) - 1
        summed_distance = sum(seg["distance_km"] for seg in route["segments"])
        summed_duration = sum(seg["duration_seconds"] for seg in route["segments"])
        assert route["total_distance_km"] == pytest.approx(summed_distance, abs=0.01)
        # abs tolerance covers per-segment rounding (each leg rounded to 0.1s before summing)
        assert route["total_duration_seconds"] == pytest.approx(summed_duration, abs=1.0)
        assert route["geometry"]["type"] == "FeatureCollection"
        assert len(route["geometry"]["features"]) == len(route["segments"])

        # 2. Get current route
        res_curr = await ac.get("/routes/1/current")
        assert res_curr.status_code == 200
        curr_route = res_curr.json()
        assert curr_route["id"] == route["id"]

        # 3. Complete first pending stop
        pending_stops = [s for s in curr_route["stops"] if s["status"] == "pending"]
        assert len(pending_stops) > 0
        first_pending = pending_stops[0]

        res_complete = await ac.post(f"/routes/{curr_route['id']}/stop/{first_pending['id']}/complete")
        assert res_complete.status_code == 200
        updated_route = res_complete.json()
        completed_stop = next(s for s in updated_route["stops"] if s["id"] == first_pending["id"])
        assert completed_stop["status"] == "done"


@pytest.mark.asyncio
async def test_demo_reset():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/demo/reset")
        assert res.status_code == 200
        assert res.json()["status"] == "success"


@pytest.mark.asyncio
async def test_demo_randomize():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/demo/randomize?num_orders=8")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert data["num_orders"] == 8
        assert len(data["orders"]) == 8
        assert "depot" in data
        assert "lat" in data["depot"] and "lng" in data["depot"]

