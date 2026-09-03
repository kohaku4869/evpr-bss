// Pure, DOM-free port of the vehicle animation engine from
// backend/app/static/app.js (initVehiclePositionFromRoute, loadCurrentSegmentCoordinates,
// stepDriveEngine, advanceVehicleToNextStop, syncDrivingSegmentAfterPatch,
// getCurrentTargetStop, isSameStop). Operates on an explicit state object instead
// of module-level globals, and does not touch the DOM.

export function loadSegmentCoordinates(route, segmentIdx) {
  if (!route || !route.segments || segmentIdx >= route.segments.length) return [];

  const segment = route.segments[segmentIdx];
  if (segment?.geometry?.coordinates) {
    // GeoJSON [lng, lat] -> Leaflet [lat, lng]
    return segment.geometry.coordinates.map((pt) => [pt[1], pt[0]]);
  }
  const s1 = route.stops?.[segmentIdx];
  const s2 = route.stops?.[segmentIdx + 1];
  if (s1 && s2) return [[s1.lat, s1.lng], [s2.lat, s2.lng]];
  return [];
}

// Computes vehicle position/segment from the route's current stop statuses.
// Used both to place the vehicle on first load and to re-place it after a
// stop is completed (the underlying logic is identical: find the first
// pending stop and stand at the end of the leg leading to it).
export function positionFromRoute(route) {
  const stops = route?.stops;
  if (!stops || stops.length === 0) return null;

  const pendingIdx = stops.findIndex((s) => s.status === 'pending');
  let segmentIdx;
  let vehiclePos;

  if (pendingIdx === -1) {
    segmentIdx = stops.length - 1;
    vehiclePos = [stops[segmentIdx].lat, stops[segmentIdx].lng];
  } else {
    segmentIdx = Math.max(0, pendingIdx - 1);
    vehiclePos = [stops[segmentIdx].lat, stops[segmentIdx].lng];
  }

  return {
    segmentIdx,
    coordIdx: 0,
    segmentCoords: loadSegmentCoordinates(route, segmentIdx),
    vehiclePos,
  };
}

export function getTargetStop(route, state) {
  const idx = state.segmentIdx + 1;
  return route?.stops && idx < route.stops.length ? route.stops[idx] : null;
}

export function isSameStop(a, b) {
  if (!a || !b) return false;
  return a.stop_type === b.stop_type && a.ref_order_id === b.ref_order_id && a.ref_station_id === b.ref_station_id;
}

// Advances one animation tick. Returns { state, arrived, targetStop }.
// When arrived is true, the caller owns deciding what happens next (Driver
// Mode pauses here until the user taps "Complete Stop", unlike the admin
// dashboard which auto-completes).
export function stepOnce(route, state) {
  let { segmentCoords } = state;
  if (!segmentCoords || segmentCoords.length === 0) {
    segmentCoords = loadSegmentCoordinates(route, state.segmentIdx);
  }

  if (state.coordIdx < segmentCoords.length) {
    return {
      state: {
        ...state,
        segmentCoords,
        vehiclePos: segmentCoords[state.coordIdx],
        coordIdx: state.coordIdx + 1,
      },
      arrived: false,
      targetStop: null,
    };
  }

  return {
    state: { ...state, segmentCoords },
    arrived: true,
    targetStop: getTargetStop(route, state),
  };
}

// Ported from syncDrivingSegmentAfterPatch: keeps the vehicle from teleporting
// backward when a reroute (station-down patch or new-order insert) changes the
// remaining route mid-leg.
export function syncAfterPatch(route, state, previousTargetStop) {
  const stops = route?.stops;
  if (!stops) return state;

  const pendingIdx = stops.findIndex((s) => s.status === 'pending');
  if (pendingIdx === -1) return state;

  const newTarget = stops[pendingIdx];
  const segmentIdx = Math.max(0, pendingIdx - 1);

  if (isSameStop(previousTargetStop, newTarget)) {
    const segmentCoords = loadSegmentCoordinates(route, segmentIdx);
    const coordIdx = Math.min(state.coordIdx, Math.max(0, segmentCoords.length - 1));
    return { ...state, segmentIdx, segmentCoords, coordIdx, vehiclePos: state.vehiclePos };
  }

  if (state.vehiclePos && newTarget?.lat != null && newTarget?.lng != null) {
    return {
      ...state,
      segmentIdx,
      segmentCoords: [state.vehiclePos, [newTarget.lat, newTarget.lng]],
      coordIdx: 0,
    };
  }

  return {
    ...state,
    segmentIdx,
    segmentCoords: loadSegmentCoordinates(route, segmentIdx),
    coordIdx: 0,
  };
}

// Ported from updateVehicleHUD/renderRouteStats: battery/load are planned
// per-stop figures from ALNS (arriving_battery), not live telemetry.
export function deriveVehicleStatus(route, targetStop) {
  const batteryCapacity = route?.battery_capacity_kwh || 1.5;
  const stops = route?.stops || [];
  const reference = targetStop || [...stops].reverse().find((s) => s.status === 'done') || stops[0] || null;

  const batteryKwh = reference?.arriving_battery ?? batteryCapacity;
  const batteryPercent = Math.min(100, Math.max(0, Math.round((batteryKwh / batteryCapacity) * 100)));
  const load = reference?.current_load ?? 0;

  return { batteryKwh, batteryCapacity, batteryPercent, load };
}
