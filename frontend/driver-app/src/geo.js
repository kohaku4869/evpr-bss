// Pure geo helpers for client-side "nearest station" lookups. Distinct from
// backend/app/core/cost.py's Haversine (that one feeds ALNS cost calculations
// with real road-network overrides) — this is a lightweight straight-line
// estimate for presentational UI only (low-battery navigate screen, range hints).
const EARTH_RADIUS_KM = 6371;

export function haversineKm(lat1, lng1, lat2, lng2) {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const rLat1 = (lat1 * Math.PI) / 180;
  const rLat2 = (lat2 * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

// Closest available station to (lat, lng), or null if none are available.
export function findNearestStation(stations, lat, lng) {
  if (lat == null || lng == null) return null;

  let nearest = null;
  let nearestKm = Infinity;
  for (const station of stations || []) {
    if (!station.is_available) continue;
    const distanceKm = haversineKm(lat, lng, station.lat, station.lng);
    if (distanceKm < nearestKm) {
      nearest = station;
      nearestKm = distanceKm;
    }
  }

  return nearest ? { station: nearest, distanceKm: nearestKm } : null;
}
