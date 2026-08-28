from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from app.config import settings
from app.db.database import engine, Base, SessionLocal
from app.db.init_db import seed_demo_data
from app.models.order import Order
from app.models.routing_cache import RoutingCache
from app.api import api_router
from app.services.event_bus import event_bus
from app.services.route_service import handle_station_status_event
from app.mock.swap_station_simulator import station_simulator


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Initialize DB tables
    Base.metadata.create_all(bind=engine)

    # 2. Seed demo data if DB is empty
    with SessionLocal() as db:
        order_count = db.query(Order).count()
        if order_count == 0:
            seed_demo_data(db)

    # 3. Start Event Bus Worker & Register Subscribers
    event_bus.start_worker()
    event_bus.subscribe("station_status_changed", handle_station_status_event)

    yield

    # Shutdown
    station_simulator.stop()
    await event_bus.stop_worker()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routers
app.include_router(api_router, prefix=settings.API_V1_STR)
# Direct routes without prefix for root compatibility with plan.md
app.include_router(api_router)

# Static files and Web Mini App
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.get("/demo", include_in_schema=False)
@app.get("/", include_in_schema=False)
async def serve_demo():
    index_file = os.path.join(static_dir, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"message": "EVPR-BSS Backend Running. Static UI not found."}
