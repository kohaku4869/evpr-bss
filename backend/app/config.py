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
    # Max battery units / kWh. Tuned for REAL road-network distances (post OSRM
    # table matrix integration) rather than straight-line: at 40 the demo route's
    # battery margin was razor-thin on real road km, so nearly every alternative
    # BSS candidate failed the reactive local-patch feasibility check (0/29
    # feasible in a manual sweep). At 60, ALNS still requires ~1 swap station per
    # ~45-55km Hanoi tour (battery-aware routing stays demonstrable), while the
    # reactive layer has enough margin to usually find a feasible replacement
    # station (~21/29 in the same sweep) when the planned one goes down.
    BATTERY_CAPACITY_B: float = 60.0
    BASE_CONSUMPTION_RATE: float = 2.2  # energy per km with 0 load
    LOAD_CONSUMPTION_FACTOR: float = 0.04  # additional energy per km per unit load
    DEFAULT_SWAP_COST: float = 5.0
    # Safety reserve model: the vehicle is never allowed to plan/arrive below this
    # fraction of capacity, and a swap/charge only tops it up to this fraction (not
    # 100%) rather than a full charge. This keeps a real buffer in the battery at
    # all times so that when a reactive event fires (station down, new order),
    # there is still slack to reach a farther station instead of the plan already
    # having used the pack down to empty.
    BATTERY_MIN_RESERVE_RATIO: float = 0.15
    BATTERY_SWAP_TARGET_RATIO: float = 0.80

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
