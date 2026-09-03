import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchStations } from '../api';
import { MOCK_SHIPPERS } from '../data/mockFleet';
import { ROAD_CORRIDORS } from '../data/roadCorridors';
import { ORDER_HOTSPOTS } from '../data/orderHotspots';

const TICK_MS = 4000;
const OVERLOAD_THRESHOLD = 75;
export const SLOTS_PER_STATION = 12;
const FULL_THRESHOLD = 95;

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

// Small random-walk step rather than pure noise, so values drift smoothly
// tick to tick instead of flickering — reads as "live" data, not static jitter.
function step(value, delta, min, max) {
  return clamp(value + (Math.random() - 0.5) * delta, min, max);
}

// Each station's cabinet is simulated as SLOTS_PER_STATION individual
// battery slots (not just one aggregate load number) — 'load'/'overloaded'
// are then *derived* from how many slots are actually full, so the overload
// signal and the per-battery detail view always agree (see plan doc: these
// used to be two independent random walks that could tell inconsistent
// stories, e.g. "83% overloaded" next to "10/12 available").
function seedSlot() {
  // A real BSS cabinet spends most of its time mostly full — swaps are
  // relatively infrequent events, not constant churn — so bias the seed
  // toward 'full' instead of a flat 0-100 draw (uniform would put only ~5%
  // of slots above the 95% full threshold, making nearly every station look
  // maxed-out "overloaded" from the very first tick).
  const r = Math.random();
  if (r < 0.08) return { chargePercent: 0, status: 'empty' };
  if (r < 0.70) return { chargePercent: Math.round(95 + Math.random() * 5), status: 'full' };
  const chargePercent = Math.round(15 + Math.random() * 79);
  return { chargePercent, status: chargePercent >= FULL_THRESHOLD ? 'full' : 'charging' };
}

function seedStationSlots(stations) {
  const slots = {};
  for (const s of stations) {
    slots[s.id] = Array.from({ length: SLOTS_PER_STATION }, seedSlot);
  }
  return slots;
}

function tickSlot(slot) {
  if (slot.status === 'full') {
    // Small chance a customer just swapped this battery out for a depleted one.
    if (Math.random() < 0.08) {
      return { chargePercent: Math.round(5 + Math.random() * 20), status: 'charging' };
    }
    return slot;
  }
  if (slot.status === 'charging') {
    const chargePercent = Math.min(100, slot.chargePercent + Math.round(3 + Math.random() * 8));
    return { chargePercent, status: chargePercent >= FULL_THRESHOLD ? 'full' : 'charging' };
  }
  // 'empty' — small chance a depleted battery gets docked and starts charging.
  if (Math.random() < 0.15) {
    return { chargePercent: Math.round(5 + Math.random() * 15), status: 'charging' };
  }
  return slot;
}

function seedCorridorIntensity() {
  const intensity = {};
  for (const c of ROAD_CORRIDORS) {
    intensity[c.id] = clamp(c.baseIntensity + (Math.random() - 0.5) * 0.2, 0.1, 1);
  }
  return intensity;
}

function seedHotspotIntensity() {
  const intensity = {};
  for (const h of ORDER_HOTSPOTS) {
    intensity[h.id] = clamp(h.baseIntensity + (Math.random() - 0.5) * 0.2, 0.1, 1);
  }
  return intensity;
}

// Scatters weighted points in a small radius around each hotspot center —
// leaflet.heat reads better from a cluster of points than one hot pixel.
function buildOrderHeatPoints(hotspotIntensity) {
  const points = [];
  for (const h of ORDER_HOTSPOTS) {
    const intensity = hotspotIntensity[h.id] ?? h.baseIntensity;
    const clusterSize = 10;
    for (let i = 0; i < clusterSize; i++) {
      points.push([
        h.lat + (Math.random() - 0.5) * 0.012,
        h.lng + (Math.random() - 0.5) * 0.012,
        intensity,
      ]);
    }
  }
  return points;
}

// Interpolates a handful of weighted [lat, lng, intensity] points along each
// corridor's waypoints — the raw input leaflet.heat expects.
function buildHeatPoints(corridorIntensity) {
  const points = [];
  for (const corridor of ROAD_CORRIDORS) {
    const intensity = corridorIntensity[corridor.id] ?? corridor.baseIntensity;
    const { waypoints } = corridor;
    for (let i = 0; i < waypoints.length - 1; i++) {
      const [lat1, lng1] = waypoints[i];
      const [lat2, lng2] = waypoints[i + 1];
      const steps = 4;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        points.push([
          lat1 + (lat2 - lat1) * t,
          lng1 + (lng2 - lng1) * t,
          intensity,
        ]);
      }
    }
  }
  return points;
}

// Single ticking source of "live" data for the dashboard: fleet positions/
// battery, per-station battery-slot cabinets, per-corridor congestion. All
// simulated client-side (setInterval random-walk) — see plan doc, the
// backend has no multi-shipper fleet or traffic feed yet. Station identity/
// coordinates are the one real thing here, fetched once from the existing
// GET /stations.
export function useSimulatedFleet() {
  const [stations, setStations] = useState([]);
  const [shippers, setShippers] = useState(MOCK_SHIPPERS);
  const [stationSlots, setStationSlots] = useState({});
  const [corridorIntensity, setCorridorIntensity] = useState(seedCorridorIntensity);
  const [hotspotIntensity, setHotspotIntensity] = useState(seedHotspotIntensity);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const stationsRef = useRef(stations);
  stationsRef.current = stations;

  const refetchStations = useCallback(() => {
    return fetchStations()
      .then((data) => {
        setStations(data);
        setStationSlots((prev) => {
          const unseen = data.filter((s) => !prev[s.id]);
          if (unseen.length === 0) return prev;
          return { ...prev, ...seedStationSlots(unseen) };
        });
      })
      .catch((err) => console.error('Error fetching stations:', err));
  }, []);

  useEffect(() => {
    refetchStations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setShippers((prev) => prev.map((s) => {
        // Only 'driving' vehicles roam — idle/charging/maintenance are
        // parked (at a stop, a station, or a workshop), so their position
        // holds still while battery still evolves appropriately.
        const isDriving = s.status === 'driving';
        return {
          ...s,
          lat: isDriving ? step(s.lat, 0.006, 20.90, 21.10) : s.lat,
          lng: isDriving ? step(s.lng, 0.006, 105.70, 105.95) : s.lng,
          battery: s.status === 'charging'
            ? clamp(s.battery + Math.random() * 8, 0, 100)
            : s.status === 'maintenance'
              ? s.battery
              : clamp(s.battery - Math.random() * 1.5, 0, 100),
        };
      }));

      setStationSlots((prev) => {
        const next = {};
        for (const [id, slots] of Object.entries(prev)) {
          next[id] = slots.map(tickSlot);
        }
        return next;
      });

      setCorridorIntensity((prev) => {
        const next = { ...prev };
        for (const c of ROAD_CORRIDORS) {
          next[c.id] = step(prev[c.id] ?? c.baseIntensity, 0.25, 0.1, 1);
        }
        return next;
      });

      setHotspotIntensity((prev) => {
        const next = { ...prev };
        for (const h of ORDER_HOTSPOTS) {
          next[h.id] = step(prev[h.id] ?? h.baseIntensity, 0.25, 0.1, 1);
        }
        return next;
      });

      setLastUpdated(new Date());
    }, TICK_MS);

    return () => clearInterval(interval);
  }, []);

  const heatPoints = buildHeatPoints(corridorIntensity);
  const orderHeatPoints = buildOrderHeatPoints(hotspotIntensity);
  const corridors = ROAD_CORRIDORS.map((c) => ({ ...c, intensity: corridorIntensity[c.id] ?? c.baseIntensity }));
  const stationsWithLoad = stations.map((s) => {
    const slots = stationSlots[s.id] || [];
    const availableBatteries = slots.filter((sl) => sl.status === 'full').length;
    const chargingBatteries = slots.filter((sl) => sl.status === 'charging').length;
    const emptyBatteries = slots.filter((sl) => sl.status === 'empty').length;
    const load = slots.length ? Math.round(100 - (availableBatteries / slots.length) * 100) : 0;
    return {
      ...s,
      load,
      overloaded: load >= OVERLOAD_THRESHOLD,
      availableBatteries,
      chargingBatteries,
      emptyBatteries,
      slots,
    };
  });
  const avgCongestion = corridors.length
    ? Math.round((corridors.reduce((sum, c) => sum + c.intensity, 0) / corridors.length) * 100)
    : 0;

  return {
    stations: stationsWithLoad,
    shippers,
    corridors,
    heatPoints,
    orderHeatPoints,
    lastUpdated,
    avgCongestion,
    overloadThreshold: OVERLOAD_THRESHOLD,
    refetchStations,
  };
}
