import { useCallback, useEffect, useRef, useState } from 'react';

const SCAN_MS = 6000;
const MAX_PENDING = 5;
const CONGESTION_THRESHOLD = 0.75;
const NEARBY_KM = 4;

let nextId = 1;

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestPointOnCorridor(corridor, lat, lng) {
  return corridor.waypoints.reduce((min, [wLat, wLng]) => Math.min(min, haversineKm(lat, lng, wLat, wLng)), Infinity);
}

// A group of drivers "plausibly affected" by one root cause — nearby active
// drivers first (reads as connected to the map), padded with any other
// active driver if the area is thin, so a group is never degenerate.
function affectedShippers(activeShippers, isNear) {
  const near = activeShippers.filter(isNear);
  const pool = near.length >= 2 ? near : activeShippers;
  const count = Math.min(pool.length, 2 + Math.floor(Math.random() * 3));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Scans the current simulated fleet/station/corridor state (from
// useSimulatedFleet) and proposes GROUPED reroutes — one action per root
// cause covering every driver it plausibly affects, not one card per
// driver (that doesn't scale once the fleet is large). Stands in for a
// future backend AI suggestion engine; there is none today (see plan doc).
function scanForSuggestion({ stations, shippers, corridors }, pendingKeys) {
  const overloaded = stations.filter((s) => s.overloaded && !pendingKeys.has(`station-${s.id}`));
  const congested = corridors.filter((c) => c.intensity >= CONGESTION_THRESHOLD && !pendingKeys.has(`corridor-${c.id}`));

  const candidates = [
    ...overloaded.map((s) => ({ kind: 'station', data: s })),
    ...congested.map((c) => ({ kind: 'corridor', data: c })),
  ];
  if (candidates.length === 0) return null;

  const choice = candidates[Math.floor(Math.random() * candidates.length)];
  const activeShippers = shippers.filter((s) => s.status === 'driving');
  if (activeShippers.length === 0) return null;

  if (choice.kind === 'station') {
    const station = choice.data;
    const alternatives = stations
      .filter((s) => s.id !== station.id && s.is_available && s.load < station.load)
      .sort((a, b) => a.load - b.load);
    const alternative = alternatives[0];
    if (!alternative) return null;

    const affected = affectedShippers(activeShippers, (s) => haversineKm(s.lat, s.lng, station.lat, station.lng) <= NEARBY_KM);

    return {
      id: nextId++,
      key: `station-${station.id}`,
      type: 'station_overload',
      severity: station.load >= 90 ? 'critical' : 'warning',
      title: `${station.name} đang quá tải (${station.load}%)`,
      message: `Gợi ý điều ${affected.length} tài xế đang ở gần sang ${alternative.name} (${alternative.load}% tải) thay vì ${station.name}.`,
      affectedShippers: affected.map((s) => ({ id: s.id, name: s.name })),
      proposedStationId: alternative.id,
      fallbackStationId: station.id,
      createdAt: new Date(),
    };
  }

  const corridor = choice.data;
  const affected = affectedShippers(activeShippers, (s) => nearestPointOnCorridor(corridor, s.lat, s.lng) <= NEARBY_KM);

  return {
    id: nextId++,
    key: `corridor-${corridor.id}`,
    type: 'congestion',
    severity: corridor.intensity >= 0.9 ? 'critical' : 'warning',
    title: `Đường ${corridor.name} đang ùn tắc nặng`,
    message: `Gợi ý điều hướng ${affected.length} tài xế tránh ${corridor.name} trong lúc mật độ giao thông cao.`,
    affectedShippers: affected.map((s) => ({ id: s.id, name: s.name })),
    corridorId: corridor.id,
    createdAt: new Date(),
  };
}

export function useAiSuggestions(simState) {
  const [pending, setPending] = useState([]);
  const [decisionLog, setDecisionLog] = useState([]);
  const simStateRef = useRef(simState);
  simStateRef.current = simState;

  useEffect(() => {
    const interval = setInterval(() => {
      setPending((prev) => {
        if (prev.length >= MAX_PENDING) return prev;
        const pendingKeys = new Set(prev.map((p) => p.key));
        const next = scanForSuggestion(simStateRef.current, pendingKeys);
        return next ? [next, ...prev] : prev;
      });
    }, SCAN_MS);
    return () => clearInterval(interval);
  }, []);

  const logDecision = useCallback((entry) => {
    setDecisionLog((log) => [{ ...entry, decidedAt: new Date() }, ...log].slice(0, 30));
  }, []);

  // Whole-group actions — the default interaction, since approving/rejecting
  // one root cause for every driver it affects is the point of grouping.
  const approveGroup = useCallback((id) => {
    setPending((prev) => {
      const group = prev.find((g) => g.id === id);
      if (!group) return prev;
      logDecision({ ...group, outcome: 'approved', note: `Duyệt cho ${group.affectedShippers.length} tài xế: ${group.title}` });
      return prev.filter((g) => g.id !== id);
    });
  }, [logDecision]);

  const rejectGroup = useCallback((id) => {
    setPending((prev) => {
      const group = prev.find((g) => g.id === id);
      if (!group) return prev;
      logDecision({ ...group, outcome: 'rejected', note: `Từ chối: ${group.title}` });
      return prev.filter((g) => g.id !== id);
    });
  }, [logDecision]);

  const manualEditGroup = useCallback((id, note) => {
    setPending((prev) => {
      const group = prev.find((g) => g.id === id);
      if (!group) return prev;
      logDecision({ ...group, outcome: 'manual', note });
      return prev.filter((g) => g.id !== id);
    });
  }, [logDecision]);

  // Drill-down: resolve a single driver out of a group without touching the
  // rest — the group shrinks, and disappears once everyone's been handled.
  const resolveOne = useCallback((groupId, shipperId, outcome) => {
    setPending((prev) => prev.flatMap((group) => {
      if (group.id !== groupId) return [group];
      const shipper = group.affectedShippers.find((s) => s.id === shipperId);
      if (shipper) {
        logDecision({ ...group, outcome, note: `${outcome === 'approved' ? 'Duyệt' : 'Từ chối'} riêng ${shipper.name}: ${group.title}` });
      }
      const remaining = group.affectedShippers.filter((s) => s.id !== shipperId);
      return remaining.length ? [{ ...group, affectedShippers: remaining }] : [];
    }));
  }, [logDecision]);

  const approveOne = useCallback((groupId, shipperId) => resolveOne(groupId, shipperId, 'approved'), [resolveOne]);
  const rejectOne = useCallback((groupId, shipperId) => resolveOne(groupId, shipperId, 'rejected'), [resolveOne]);

  // For ad-hoc dispatch not tied to any AI suggestion (e.g. "Điều phối thủ
  // công" standalone button) — logs straight to the decision log.
  const logManualEntry = useCallback((note) => {
    logDecision({ id: `manual-${Date.now()}`, outcome: 'manual', note, title: note });
  }, [logDecision]);

  return { pending, decisionLog, approveGroup, rejectGroup, manualEditGroup, approveOne, rejectOne, logManualEntry };
}
