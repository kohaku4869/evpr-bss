import pytest
from app.core import cost as cost_module


@pytest.fixture(autouse=True)
def _reset_distance_matrix_cache():
    """
    The road-distance matrix cache in app.core.cost is process-global by design
    (it's meant to stay warm across requests within a single demo server process).
    Tests run in the same process, so without this reset a matrix warmed by one
    test (e.g. an API integration test that calls POST /plan/optimize) would leak
    into unrelated tests that assume a cold Haversine-only cache.
    """
    cost_module.clear_distance_matrix_cache()
    yield
    cost_module.clear_distance_matrix_cache()
