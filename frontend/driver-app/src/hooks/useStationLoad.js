import { useEffect, useState } from 'react';

const TICK_MS = 5000;

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function step(value, delta, min, max) {
  return clamp(value + (Math.random() - 0.5) * delta, min, max);
}

// Lightweight, driver-app-local "how busy is this station right now" — one
// random-walked number per station, not the admin dashboard's full per-slot
// cabinet simulation (overkill for a quick glance while driving; see
// frontend/admin-dashboard/src/hooks/useSimulatedFleet.js for that one).
// No real backend field for this yet, so it's presentational only.
export function useStationLoad(stations) {
  const [load, setLoad] = useState({});

  useEffect(() => {
    setLoad((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const s of stations) {
        if (next[s.id] == null) {
          next[s.id] = Math.round(20 + Math.random() * 60);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [stations]);

  useEffect(() => {
    const interval = setInterval(() => {
      setLoad((prev) => {
        const next = {};
        for (const [id, v] of Object.entries(prev)) {
          next[id] = Math.round(step(v, 20, 5, 100));
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(interval);
  }, []);

  return load;
}
