import { API_BASE, SHIPPER_ID } from './config';

export async function fetchCurrentRoute() {
  const res = await fetch(`${API_BASE}/routes/${SHIPPER_ID}/current`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`fetchCurrentRoute failed: ${res.status}`);
  return res.json();
}

export async function fetchStations() {
  const res = await fetch(`${API_BASE}/stations`);
  if (!res.ok) throw new Error(`fetchStations failed: ${res.status}`);
  return res.json();
}

export async function completeStop(routeId, stopId) {
  const res = await fetch(`${API_BASE}/routes/${routeId}/stop/${stopId}/complete`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`completeStop failed: ${res.status}`);
  return res.json();
}
