import asyncio
import random
from typing import Optional
from app.db.database import SessionLocal
from app.models.station import Station
from app.services.station_service import update_station_status


class SwapStationSimulator:
    """
    Simulates battery swap stations in 2 modes:
    1. Manual trigger: directly call update_station_status(id, is_available)
    2. Automated background simulation: periodically randomly flips availability of a station.
    """
    def __init__(self):
        self._task: Optional[asyncio.Task] = None
        self.is_running: bool = False
        self.interval_seconds: float = 15.0
        self.flip_probability: float = 0.3

    def start(self, interval_seconds: float = 15.0, flip_probability: float = 0.3):
        if self._task and not self._task.done():
            return
        self.interval_seconds = interval_seconds
        self.flip_probability = flip_probability
        self.is_running = True
        self._task = asyncio.create_task(self._run_loop())

    def stop(self):
        self.is_running = False
        if self._task and not self._task.done():
            self._task.cancel()

    async def _run_loop(self):
        while self.is_running:
            try:
                await asyncio.sleep(self.interval_seconds)
                if random.random() < self.flip_probability:
                    db = SessionLocal()
                    try:
                        stations = db.query(Station).all()
                        if stations:
                            chosen = random.choice(stations)
                            new_status = not chosen.is_available
                            await update_station_status(db, chosen.id, new_status)
                    finally:
                        db.close()
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"[Simulator] Error in simulation step: {e}")


station_simulator = SwapStationSimulator()
