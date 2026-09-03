import os
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_DB_PATH = os.path.join(BACKEND_DIR, "evrp_demo.db").replace("\\", "/")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    PROJECT_NAME: str = "EVPR-BSS Dynamic Routing"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"

    # Database: points directly to backend/evrp_demo.db
    DATABASE_URL: str = f"sqlite:///{DEFAULT_DB_PATH}"

    # Vehicle and Battery parameters. Demo depot is near Hoan Kiem, Hanoi.
    DEPOT_LAT: float = 21.0285
    DEPOT_LNG: float = 105.8542
    VEHICLE_CAPACITY_Q: float = 50.0  # Max payload kg
    # Max battery capacity (kWh). Standard swappable pack for urban delivery
    # e-motorbikes in Vietnam (e.g. Selex Camel, Honda Mobile Power Pack e: 1.3 - 1.5 kWh).
    # With 1.5 kWh and 0.025 kWh/km, a full charge gives ~45-50km usable range, which
    # naturally requires ~1 swap station visit on a ~45-55km Hanoi delivery tour.
    BATTERY_CAPACITY_B: float = 1.5
    BASE_CONSUMPTION_RATE: float = 0.025  # energy (kWh) per km with 0 load (25 Wh/km)
    LOAD_CONSUMPTION_FACTOR: float = 0.0004  # additional kWh per km per kg of cargo
    DEFAULT_SWAP_COST: float = 9.0  # 9.0 kVNĐ (~9,000 VND / pack swap fee)
    # Safety reserve model: the vehicle is never allowed to plan/arrive below this
    # fraction of capacity (15% reserve floor).
    BATTERY_MIN_RESERVE_RATIO: float = 0.15
    # Swapping provides a fresh battery charged to 95% at the BSS.
    BATTERY_SWAP_TARGET_RATIO: float = 0.95

    # Real map/routing parameters
    TOMTOM_API_KEY: str = ""
    OPENWEATHER_API_KEY: str = ""
    ROUTING_PROVIDER: str = "tomtom"
    ROUTING_ENABLE_EXTERNAL: bool = True
    OSRM_BASE_URL: str = "https://router.project-osrm.org"
    ROUTING_TIMEOUT_SECONDS: float = 4.0
    ROUTING_COORD_PRECISION: int = 5

    # ALNS Static Parameters
    ALNS_MAX_ITERATIONS: int = 200
    ALNS_TIME_LIMIT_SECONDS: float = 5.0
    ALNS_START_TEMPERATURE: float = 100.0
    ALNS_COOLING_RATE: float = 0.985
    ALNS_SEGMENT_LENGTH: int = 25
    ALNS_REACTION_FACTOR: float = 0.1
    ALNS_SCORE_SIGMA1: float = 33.0  # New global best
    ALNS_SCORE_SIGMA2: float = 9.0   # Better than current
    ALNS_SCORE_SIGMA3: float = 3.0   # Accepted worse solution
    ALNS_RANDOM_SEED: int = 42

    # Reactive layer
    REACTIVE_MAX_LATENCY_WARNING_MS: float = 1500.0


settings = Settings()
