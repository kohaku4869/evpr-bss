from fastapi import APIRouter
from app.api.routes_orders import router as orders_router
from app.api.routes_stations import router as stations_router
from app.api.routes_plan import router as plan_router
from app.api.routes_tracking import router as tracking_router
from app.api.routes_demo import router as demo_router
from app.api.ws_realtime import router as ws_router

api_router = APIRouter()
api_router.include_router(orders_router)
api_router.include_router(stations_router)
api_router.include_router(plan_router)
api_router.include_router(tracking_router)
api_router.include_router(demo_router)
api_router.include_router(ws_router)

__all__ = ["api_router"]
