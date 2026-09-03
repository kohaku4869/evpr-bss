import { API_BASE } from './config';

// The only real backend calls in this app — everything else (fleet
// positions, congestion, AI suggestions) is simulated client-side, see
// src/hooks. updateStationStatus is the same PATCH backend/app/static/app.js
// (toggleStation) already makes for the /demo dashboard.
export async function fetchStations() {
  const res = await fetch(`${API_BASE}/stations`);
  if (!res.ok) throw new Error(`fetchStations failed: ${res.status}`);
  return res.json();
}

export async function updateStationStatus(id, isAvailable) {
  const res = await fetch(`${API_BASE}/stations/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_available: isAvailable }),
  });
  if (!res.ok) throw new Error(`updateStationStatus failed: ${res.status}`);
  return res.json();
}
