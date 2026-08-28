let currentRoute = null;
let stations = [];
let stationFilter = "all";
let stationSearchQuery = "";
let ws = null;
let simulatorRunning = false;

// Leaflet map state
const HANOI_CENTER = [21.0285, 105.8542];
let map = null;
let stationMarkersLayer = null;
let stopMarkersLayer = null;
let routeLayer = null;
let vehicleMarker = null;
let hasFitBounds = false;

// Live Driving Animation Engine
let isDriving = false;
let driveSpeed = 1;
let driveTimer = null;
let currentSegmentIdx = 0;
let currentCoordIdx = 0;
let currentSegmentCoords = [];
let currentVehiclePos = null;
let currentBattery = 40.0;
let currentLoad = 0.0;

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
  initMap();
  initWebSocket();
  fetchStations();
  fetchCurrentRoute();
  fetchSimulatorStatus();
});

// Map Initialization (Leaflet + OpenStreetMap)
function initMap() {
  map = L.map("hanoiMap", { zoomControl: true }).setView(HANOI_CENTER, 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map);

  stationMarkersLayer = L.layerGroup().addTo(map);
  stopMarkersLayer = L.layerGroup().addTo(map);
  routeLayer = L.layerGroup().addTo(map);
}

// WebSocket Connection
function initWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws/route/1`;
  const wsBadge = document.getElementById("ws-status");
  const wsText = document.getElementById("ws-status-text");

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      wsBadge.className = "status-badge connected";
      wsText.textContent = "WS Live Connected";
      addLog("WebSocket connected to live route channel #1", "info");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketEvent(data);
      } catch (err) {
        console.error("Error parsing WS message:", err);
      }
    };

    ws.onclose = () => {
      wsBadge.className = "status-badge connecting";
      wsText.textContent = "WS Reconnecting...";
      setTimeout(initWebSocket, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  } catch (err) {
    console.error("WebSocket init error:", err);
  }
}

// WebSocket Event Handler
function handleWebSocketEvent(data) {
  if (data.event === "route_patched") {
    showPatchBanner(data);
    if (data.reason === "new_order_added") {
      addLog(`➕ NEW ORDER INJECTED LIVE! ${data.new_stop?.label || 'New order'} inserted into mutable suffix in ${data.latency_ms}ms (matrix: ${data.matrix_source || 'n/a'})`, "patch");
    } else {
      addLog(`⚡ ROUTE PATCHED! ${data.old_stop?.name || data.old_stop?.label || 'Station'} ➔ ${data.new_stop?.name || data.new_stop?.label || 'New Station'} in ${data.latency_ms}ms`, "patch");
    }

    // Capture the stop the vehicle is currently heading to BEFORE currentRoute
    // gets overwritten below, so syncDrivingSegmentAfterPatch can tell whether
    // the patch changed the vehicle's immediate destination.
    const previousTargetStop = getCurrentTargetStop();

    // Update route data seamlessly
    fetchCurrentRoute(false).then(() => {
      if (isDriving) {
        // Recalculate current segment coordinates so vehicle continues smoothly on new route
        syncDrivingSegmentAfterPatch(previousTargetStop);
      }
    });
    fetchStations();
  } else if (data.event === "route_patch_failed") {
    addLog(`⚠️ Route patch failed for Station #${data.station_id}: ${data.reason}`, "error");
  } else if (data.event === "station_status_changed") {
    addLog(`Station #${data.station_id} status changed to ${data.is_available ? 'Available' : 'UNAVAILABLE'}`, data.is_available ? "info" : "warn");
    fetchStations();
  }
}

// Banner controls
function showPatchBanner(data) {
  const banner = document.getElementById("patch-banner");
  const title = document.getElementById("banner-title");
  const desc = document.getElementById("banner-desc");
  const latency = document.getElementById("banner-latency");

  if (data.reason === "new_order_added") {
    title.textContent = "➕ NEW ORDER INSERTED LIVE (USP)";
    desc.textContent = `${data.new_stop?.label || 'A new order'} arrived mid-drive and was inserted into the remaining route (mutable suffix) via the real road network — frozen prefix untouched.`;
  } else {
    const oldName = data.old_stop?.name || data.old_stop?.label || 'Station';
    const newName = data.new_stop?.name || data.new_stop?.label || 'New Station';
    title.textContent = "⚡ REAL-TIME RE-ROUTE ACTIVATED (USP)";
    desc.textContent = `${oldName} is UNAVAILABLE! Dynamically patched to ${newName} via road network in < 10ms.`;
  }
  latency.textContent = `Latency: ${data.latency_ms || 0} ms`;

  banner.classList.remove("hidden");
}

function closeBanner() {
  document.getElementById("patch-banner").classList.add("hidden");
}

// API Calls
async function fetchStations() {
  try {
    const res = await fetch("/stations");
    if (res.ok) {
      stations = await res.json();
      renderStations();
      renderMap();
      const countBadge = document.getElementById("station-count-label");
      if (countBadge) countBadge.textContent = `${stations.length} Stations`;
    }
  } catch (err) {
    console.error("Error fetching stations:", err);
  }
}

async function fetchCurrentRoute(resetDrive = true) {
  try {
    const res = await fetch("/routes/1/current");
    if (res.ok) {
      currentRoute = await res.json();
      renderRouteStats();
      renderTimeline();
      renderMap();
      if (resetDrive && !isDriving) {
        initVehiclePositionFromRoute();
      }
    } else {
      currentRoute = null;
      renderRouteStats();
      renderTimeline();
      renderMap();
    }
  } catch (err) {
    console.error("Error fetching current route:", err);
  }
}

async function fetchSimulatorStatus() {
  try {
    const res = await fetch("/demo/status");
    if (res.ok) {
      const data = await res.json();
      simulatorRunning = data.simulator_running;
      updateSimulatorUI();
    }
  } catch (err) {
    console.error("Error fetching simulator status:", err);
  }
}

async function randomizeScenario() {
  const select = document.getElementById("select-num-orders");
  const numOrders = select ? parseInt(select.value, 10) : 6;
  const btn = document.getElementById("btn-randomize");
  btn.disabled = true;
  btn.innerHTML = `<span class="btn-icon">⏳</span> Randomizing...`;

  pauseLiveDrive();
  currentRoute = null;

  try {
    const res = await fetch(`/demo/randomize?num_orders=${numOrders}`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      addLog(`🎲 Scenario Randomized: ${data.depot?.name || 'Depot'} with ${data.num_orders} orders in Hanoi.`, "info");
      await fetchStations();
      await fetchCurrentRoute(true);
      closeBanner();
    } else {
      addLog("Failed to randomize scenario", "error");
    }
  } catch (err) {
    addLog(`Error randomizing scenario: ${err}`, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span class="btn-icon">🎲</span> Randomize Scenario`;
  }
}

async function triggerOptimize() {
  const btn = document.getElementById("btn-optimize");
  btn.disabled = true;
  btn.innerHTML = `<span class="btn-icon">⏳</span> Optimizing ALNS...`;

  pauseLiveDrive();

  try {
    const res = await fetch("/plan/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shipper_id: 1 })
    });

    if (res.ok) {
      currentRoute = await res.json();
      addLog(`⚡ ALNS Optimization finished! Total Cost: ${currentRoute.total_cost} (Distance: ${currentRoute.total_distance_km} km via ${currentRoute.geometry_source})`, "patch");
      addLog(`🧭 Planning distance matrix source: ${currentRoute.matrix_source || "none"} (ALNS decisions use real road km, not straight-line)`, "info");
      renderRouteStats();
      renderTimeline();
      renderMap();
      initVehiclePositionFromRoute();
    } else {
      addLog("ALNS Optimization failed", "error");
    }
  } catch (err) {
    addLog(`Optimization error: ${err}`, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span class="btn-icon">⚡</span> Run ALNS Optimize`;
  }
}

async function completeNextStop() {
  if (!currentRoute || !currentRoute.stops) return;
  const nextPending = currentRoute.stops.find(s => s.status === "pending");
  if (!nextPending) {
    addLog("All stops are already completed!", "info");
    return;
  }

  try {
    const res = await fetch(`/routes/${currentRoute.id}/stop/${nextPending.id}/complete`, {
      method: "POST"
    });
    if (res.ok) {
      currentRoute = await res.json();
      addLog(`✓ Completed stop #${nextPending.sequence_index}: ${nextPending.label} (Frozen Prefix updated)`, "info");
      renderRouteStats();
      renderTimeline();
      renderMap();
      advanceVehicleToNextStop();
    }
  } catch (err) {
    addLog(`Error completing stop: ${err}`, "error");
  }
}

async function injectLiveOrder() {
  if (!currentRoute || !currentRoute.stops || currentRoute.stops.length === 0) {
    addLog("No active route to inject an order into! Please click 'Run ALNS Optimize' first.", "warn");
    return;
  }

  const btn = document.getElementById("btn-inject-order");
  btn.disabled = true;
  btn.innerHTML = `<span class="btn-icon">⏳</span> Inserting...`;

  try {
    const res = await fetch("/orders/inject", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      addLog(`➕ Requested live order injection (order #${data.order_id}, latency ${data.latency_ms?.toFixed?.(1) ?? data.latency_ms}ms). Waiting for route_patched...`, "info");
    } else {
      const err = await res.json().catch(() => ({}));
      addLog(`⚠️ Could not inject new order: ${err.detail || res.statusText}`, "error");
    }
  } catch (err) {
    addLog(`Error injecting new order: ${err}`, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span class="btn-icon">➕</span> New Order (Live)`;
  }
}

async function toggleStation(id, currentAvail) {
  try {
    const res = await fetch(`/stations/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_available: !currentAvail })
    });
    if (res.ok) {
      await fetchStations();
    }
  } catch (err) {
    addLog(`Error toggling station: ${err}`, "error");
  }
}

async function toggleSimulator() {
  try {
    simulatorRunning = !simulatorRunning;
    await fetch(`/demo/simulator/toggle?enable=${simulatorRunning}`, { method: "POST" });
    updateSimulatorUI();
    addLog(`Auto Simulator ${simulatorRunning ? 'started' : 'stopped'}`, "info");
  } catch (err) {
    console.error("Error toggling simulator:", err);
  }
}

function updateSimulatorUI() {
  const label = document.getElementById("sim-status-label");
  const btn = document.getElementById("btn-simulator");
  if (simulatorRunning) {
    label.textContent = "ON";
    btn.classList.add("btn-success");
    btn.classList.remove("btn-dark");
  } else {
    label.textContent = "OFF";
    btn.classList.remove("btn-success");
    btn.classList.add("btn-dark");
  }
}

async function resetDemo() {
  try {
    pauseLiveDrive();
    await fetch("/demo/reset", { method: "POST" });
    addLog("Demo database reset to initial 30 Hanoi stations & seed orders.", "info");
    closeBanner();
    await fetchStations();
    await fetchCurrentRoute(true);
  } catch (err) {
    addLog(`Error resetting demo: ${err}`, "error");
  }
}

// ----------------------------------------------------
// Live Vehicle Driving Simulation Engine (Road Follower)
// ----------------------------------------------------

function initVehiclePositionFromRoute() {
  if (!currentRoute || !currentRoute.stops || currentRoute.stops.length === 0) {
    currentVehiclePos = null;
    hideVehicleHUD();
    return;
  }

  // Find first pending stop index
  const pendingIdx = currentRoute.stops.findIndex(s => s.status === "pending");
  if (pendingIdx === -1) {
    // All done
    currentSegmentIdx = currentRoute.stops.length - 1;
    const lastStop = currentRoute.stops[currentSegmentIdx];
    currentVehiclePos = [lastStop.lat, lastStop.lng];
  } else if (pendingIdx === 0) {
    currentSegmentIdx = 0;
    const startStop = currentRoute.stops[0];
    currentVehiclePos = [startStop.lat, startStop.lng];
  } else {
    currentSegmentIdx = pendingIdx - 1;
    const fromStop = currentRoute.stops[currentSegmentIdx];
    currentVehiclePos = [fromStop.lat, fromStop.lng];
  }

  currentCoordIdx = 0;
  loadCurrentSegmentCoordinates();
  updateVehicleMarker();
  updateVehicleHUD();
}

function loadCurrentSegmentCoordinates() {
  currentSegmentCoords = [];
  if (!currentRoute || !currentRoute.segments || currentSegmentIdx >= currentRoute.segments.length) {
    return;
  }

  const segment = currentRoute.segments[currentSegmentIdx];
  if (segment && segment.geometry && segment.geometry.coordinates) {
    // TomTom / OSRM GeoJSON coords: [lng, lat] -> convert to Leaflet [lat, lng]
    currentSegmentCoords = segment.geometry.coordinates.map(pt => [pt[1], pt[0]]);
  } else if (currentRoute.stops && currentRoute.stops[currentSegmentIdx] && currentRoute.stops[currentSegmentIdx + 1]) {
    const s1 = currentRoute.stops[currentSegmentIdx];
    const s2 = currentRoute.stops[currentSegmentIdx + 1];
    currentSegmentCoords = [[s1.lat, s1.lng], [s2.lat, s2.lng]];
  }
}

function toggleLiveDrive() {
  if (!currentRoute || !currentRoute.stops || currentRoute.stops.length === 0) {
    addLog("No active route to drive! Please click 'Run ALNS Optimize' first.", "warn");
    return;
  }

  if (isDriving) {
    pauseLiveDrive();
  } else {
    startLiveDrive();
  }
}

function startLiveDrive() {
  isDriving = true;
  const driveBtn = document.getElementById("btn-drive-toggle");
  const driveIcon = document.getElementById("drive-icon");
  const driveLabel = document.getElementById("drive-label");

  driveBtn.classList.add("driving");
  driveIcon.textContent = "⏸️";
  driveLabel.textContent = "Pause Drive";

  showVehicleHUD();
  addLog("🚗 Live Road Driving started...", "info");

  scheduleNextDriveStep();
}

function pauseLiveDrive() {
  isDriving = false;
  if (driveTimer) {
    clearTimeout(driveTimer);
    driveTimer = null;
  }

  const driveBtn = document.getElementById("btn-drive-toggle");
  const driveIcon = document.getElementById("drive-icon");
  const driveLabel = document.getElementById("drive-label");

  if (driveBtn) {
    driveBtn.classList.remove("driving");
    driveIcon.textContent = "▶️";
    driveLabel.textContent = "Resume Drive";
  }

  updateVehicleHUD();
}

function setDriveSpeed(speed) {
  driveSpeed = speed;
  document.querySelectorAll(".btn-speed").forEach(btn => {
    btn.classList.toggle("active", parseInt(btn.dataset.speed, 10) === speed);
  });
  const hudSpeed = document.getElementById("hud-speed");
  if (hudSpeed) hudSpeed.textContent = `${speed}x`;

  if (isDriving) {
    if (driveTimer) clearTimeout(driveTimer);
    scheduleNextDriveStep();
  }
}

function scheduleNextDriveStep() {
  if (!isDriving) return;
  // Step interval based on speed: 1x = 120ms, 2x = 60ms, 5x = 24ms, 10x = 12ms
  const baseInterval = 120;
  const interval = Math.max(10, Math.floor(baseInterval / driveSpeed));
  driveTimer = setTimeout(stepDriveEngine, interval);
}

async function stepDriveEngine() {
  if (!isDriving || !currentRoute) return;

  if (!currentSegmentCoords || currentSegmentCoords.length === 0) {
    loadCurrentSegmentCoordinates();
  }

  if (currentCoordIdx < currentSegmentCoords.length) {
    // Advance along the road coordinates
    currentVehiclePos = currentSegmentCoords[currentCoordIdx];
    currentCoordIdx++;
    updateVehicleMarker();
    updateVehicleHUD();
    scheduleNextDriveStep();
  } else {
    // Reached destination stop of this segment!
    const destStopIdx = currentSegmentIdx + 1;
    if (currentRoute.stops && destStopIdx < currentRoute.stops.length) {
      const targetStop = currentRoute.stops[destStopIdx];
      if (targetStop.status === "pending") {
        // Complete the stop. completeNextStop() -> advanceVehicleToNextStop()
        // already advances currentSegmentIdx/currentCoordIdx to the next leg
        // and loads its road coordinates, so we must NOT redo that below —
        // doing so used to double-advance and silently skip an entire leg's
        // road animation (visible as the vehicle jumping ahead).
        await completeNextStop();

        // If BSS: show quick swap animation
        if (targetStop.stop_type === "swap_station") {
          addLog(`⚡ Recharged at ${targetStop.label}! Battery restored to 100%.`, "patch");
        }
      } else {
        // Defensive fallback: stop was already completed by something else.
        currentSegmentIdx++;
        currentCoordIdx = 0;
        loadCurrentSegmentCoordinates();
      }

      if (currentSegmentIdx < (currentRoute.segments?.length || currentRoute.stops.length - 1)) {
        scheduleNextDriveStep();
      } else {
        // Finished entire tour!
        pauseLiveDrive();
        addLog("🏁 Tour Complete! All orders delivered safely.", "patch");
      }
    } else {
      pauseLiveDrive();
    }
  }
}

function advanceVehicleToNextStop() {
  if (!currentRoute || !currentRoute.stops) return;
  const pendingIdx = currentRoute.stops.findIndex(s => s.status === "pending");
  if (pendingIdx === -1) {
    currentSegmentIdx = currentRoute.stops.length - 1;
    const lastStop = currentRoute.stops[currentSegmentIdx];
    currentVehiclePos = [lastStop.lat, lastStop.lng];
  } else {
    currentSegmentIdx = Math.max(0, pendingIdx - 1);
    currentCoordIdx = 0;
    loadCurrentSegmentCoordinates();
    const fromStop = currentRoute.stops[currentSegmentIdx];
    currentVehiclePos = [fromStop.lat, fromStop.lng];
  }
  updateVehicleMarker();
  updateVehicleHUD();
}

function resetVehicleDrive() {
  pauseLiveDrive();
  if (currentRoute && currentRoute.stops && currentRoute.stops.length > 0) {
    currentSegmentIdx = 0;
    currentCoordIdx = 0;
    const startStop = currentRoute.stops[0];
    currentVehiclePos = [startStop.lat, startStop.lng];
    loadCurrentSegmentCoordinates();
    updateVehicleMarker();
    updateVehicleHUD();
    addLog("Vehicle position reset to Depot.", "info");
  }
}

function getCurrentTargetStop() {
  if (!currentRoute || !currentRoute.stops) return null;
  const idx = currentSegmentIdx + 1;
  return idx < currentRoute.stops.length ? currentRoute.stops[idx] : null;
}

function isSameStop(a, b) {
  if (!a || !b) return false;
  return a.stop_type === b.stop_type && a.ref_order_id === b.ref_order_id && a.ref_station_id === b.ref_station_id;
}

function syncDrivingSegmentAfterPatch(previousTargetStop) {
  if (!currentRoute || !currentRoute.stops) return;
  const pendingIdx = currentRoute.stops.findIndex(s => s.status === "pending");
  if (pendingIdx === -1) return;

  const newTarget = currentRoute.stops[pendingIdx];
  currentSegmentIdx = Math.max(0, pendingIdx - 1);

  if (isSameStop(previousTargetStop, newTarget)) {
    // The vehicle's immediate destination didn't change (e.g. a new order was
    // inserted further down the mutable suffix) — reload the segment geometry
    // (it's cached, so identical) but keep driving progress as-is instead of
    // snapping the vehicle back to the start of the leg.
    const keepCoordIdx = currentCoordIdx;
    loadCurrentSegmentCoordinates();
    currentCoordIdx = Math.min(keepCoordIdx, Math.max(0, currentSegmentCoords.length - 1));
  } else {
    // The immediate destination changed mid-leg (the station/order the vehicle
    // was heading to got replaced) — instead of teleporting backward to the
    // start of the old leg, draw a short direct "rerouting" hop from wherever
    // the vehicle currently is to the new destination. Normal road-following
    // resumes automatically from the next leg onward.
    if (currentVehiclePos && newTarget && newTarget.lat != null && newTarget.lng != null) {
      currentSegmentCoords = [currentVehiclePos, [newTarget.lat, newTarget.lng]];
    } else {
      loadCurrentSegmentCoordinates();
    }
    currentCoordIdx = 0;
  }

  updateVehicleMarker();
  updateVehicleHUD();
}

function updateVehicleMarker() {
  if (!map || !currentVehiclePos) return;

  if (!vehicleMarker) {
    const icon = stopDivIcon("vehicle", "🛵");
    vehicleMarker = L.marker(currentVehiclePos, { icon, zIndexOffset: 2000 }).addTo(map);
    vehicleMarker.bindPopup("<b>🛵 Shipper #1 (Active)</b><br>Cruising on Hanoi Road Network");
  } else {
    vehicleMarker.setLatLng(currentVehiclePos);
  }
}

function showVehicleHUD() {
  const hud = document.getElementById("vehicle-hud");
  if (hud) hud.classList.remove("hidden");
}

function hideVehicleHUD() {
  const hud = document.getElementById("vehicle-hud");
  if (hud) hud.classList.add("hidden");
}

function updateVehicleHUD() {
  const hud = document.getElementById("vehicle-hud");
  if (!hud) return;

  if (!currentRoute || !currentRoute.stops) {
    hud.classList.add("hidden");
    return;
  }

  hud.classList.remove("hidden");

  const titleEl = document.getElementById("hud-status-text");
  const targetEl = document.getElementById("hud-target-text");
  const batEl = document.getElementById("hud-battery");
  const loadEl = document.getElementById("hud-load");
  const speedEl = document.getElementById("hud-speed");

  const destStopIdx = currentSegmentIdx + 1;
  const targetStop = (currentRoute.stops && destStopIdx < currentRoute.stops.length)
    ? currentRoute.stops[destStopIdx]
    : null;

  if (targetStop) {
    titleEl.textContent = isDriving ? "🛵 Vehicle Cruising (Road)" : "⏸️ Drive Paused";
    targetEl.textContent = `Target #${targetStop.sequence_index}: ${targetStop.label}`;
    const batCapacity = currentRoute.battery_capacity_kwh || 40.0;
    const batVal = targetStop.arriving_battery ?? batCapacity;
    const batPercent = Math.min(100, Math.max(0, Math.round((batVal / batCapacity) * 100)));
    batEl.textContent = `${batPercent}% (${batVal}kWh)`;
    loadEl.textContent = `${targetStop.current_load ?? 0} kg`;
  } else {
    titleEl.textContent = "🏁 Tour Completed";
    targetEl.textContent = "At Destination Depot";
  }

  if (speedEl) speedEl.textContent = `${driveSpeed}x`;
}

// ----------------------------------------------------
// UI Rendering & Components
// ----------------------------------------------------

function renderRouteStats() {
  const costEl = document.getElementById("stat-cost");
  const distEl = document.getElementById("stat-distance");
  const stopsEl = document.getElementById("stat-stops");
  const batteryEl = document.getElementById("stat-battery");
  const routingEngineEl = document.getElementById("routing-engine-text");

  if (!currentRoute || !currentRoute.stops) {
    costEl.textContent = "--";
    distEl.textContent = "-- km";
    stopsEl.textContent = "-- / --";
    batteryEl.textContent = "40.0 / 40 kWh";
    return;
  }

  const doneCount = currentRoute.stops.filter(s => s.status === "done").length;
  const totalCount = currentRoute.stops.length;

  costEl.textContent = currentRoute.total_cost.toFixed(2);
  distEl.textContent = `${currentRoute.total_distance_km || '--'} km`;
  stopsEl.textContent = `${doneCount} / ${totalCount}`;

  const batCapacity = currentRoute.battery_capacity_kwh || 40.0;
  const lastActive = currentRoute.stops.filter(s => s.status === "done").pop() || currentRoute.stops[0];
  batteryEl.textContent = `${lastActive.arriving_battery ?? batCapacity} / ${batCapacity} kWh`;

  if (routingEngineEl && currentRoute.geometry_source) {
    const src = currentRoute.geometry_source.toUpperCase();
    routingEngineEl.textContent = `🗺️ ${src} Road Engine`;
  }
}

function renderStations() {
  const container = document.getElementById("stations-list");
  container.innerHTML = "";

  const filtered = stations.filter(st => {
    // Search query filter
    const matchesSearch = !stationSearchQuery ||
      st.name.toLowerCase().includes(stationSearchQuery.toLowerCase());

    // Category / District chip filter
    let matchesChip = true;
    if (stationFilter === "avail") matchesChip = st.is_available;
    else if (stationFilter === "down") matchesChip = !st.is_available;
    else if (stationFilter !== "all") {
      matchesChip = st.name.toLowerCase().includes(stationFilter.toLowerCase());
    }

    return matchesSearch && matchesChip;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state">No stations match filter.</div>`;
    return;
  }

  filtered.forEach(st => {
    const isAvail = st.is_available;
    const item = document.createElement("div");
    item.className = "station-item";
    item.innerHTML = `
      <div class="station-info">
        <span class="station-dot ${isAvail ? 'avail' : 'down'}"></span>
        <div>
          <div class="station-name">${st.name}</div>
          <div class="station-coords">(${st.lat.toFixed(4)}, ${st.lng.toFixed(4)}) • Swap Fee: $${st.cost_swap.toFixed(1)}</div>
        </div>
      </div>
      <button class="station-toggle-btn ${isAvail ? 'avail' : 'down'}" onclick="toggleStation(${st.id}, ${isAvail})">
        ${isAvail ? '⚡ Available' : '⚠️ DOWN'}
      </button>
    `;
    container.appendChild(item);
  });
}

function filterStations() {
  const input = document.getElementById("station-search-input");
  stationSearchQuery = input ? input.value.trim() : "";
  renderStations();
}

function setStationFilter(filter) {
  stationFilter = filter;
  document.querySelectorAll(".filter-chips .chip").forEach(chip => {
    chip.classList.toggle("active", chip.dataset.filter === filter || (filter === 'all' && chip.dataset.filter === 'all'));
  });
  renderStations();
}

function renderTimeline() {
  const container = document.getElementById("stops-timeline");
  container.innerHTML = "";

  if (!currentRoute || !currentRoute.stops || currentRoute.stops.length === 0) {
    container.innerHTML = `<div class="empty-state">No active route. Click "Run ALNS Optimize" above.</div>`;
    return;
  }

  const firstPendingIdx = currentRoute.stops.findIndex(s => s.status === "pending");

  currentRoute.stops.forEach((stop, idx) => {
    const isDone = stop.status === "done";
    const isActive = idx === firstPendingIdx;
    const item = document.createElement("div");
    item.className = `stop-item ${isDone ? 'done' : (isActive ? 'active' : 'pending')}`;

    let statusBadge = isDone ? '✓ Done' : (isActive ? '▶ Next' : 'Pending');

    item.innerHTML = `
      <div class="stop-left">
        <span class="stop-seq">#${stop.sequence_index}</span>
        <span class="stop-tag ${stop.stop_type}">${stop.stop_type}</span>
        <span class="stop-label">${stop.label || stop.stop_type}</span>
      </div>
      <div class="stop-metrics">
        <span>Load: ${stop.current_load}kg</span>
        <span>Bat: ${stop.arriving_battery}u</span>
        <span class="sub-badge">${statusBadge}</span>
      </div>
    `;
    container.appendChild(item);
  });
}

// Leaflet Map Visualizer
function stopDivIcon(cls, label) {
  return L.divIcon({
    className: "stop-divicon",
    html: `<div class="stop-pin ${cls}">${label}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function renderMap() {
  if (!map) return;

  stationMarkersLayer.clearLayers();
  stopMarkersLayer.clearLayers();
  routeLayer.clearLayers();

  const boundsPoints = [];

  // 1. Draw BSS Stations (All 30 Hanoi Stations)
  stations.forEach(st => {
    const latlng = [st.lat, st.lng];
    boundsPoints.push(latlng);
    const color = st.is_available ? "#f59e0b" : "#f43f5e";
    const marker = L.circleMarker(latlng, {
      radius: 9,
      color: color,
      weight: 2,
      fillColor: color,
      fillOpacity: st.is_available ? 0.35 : 0.5,
    });
    marker.bindPopup(
      `<b>${st.is_available ? "⚡" : "✕ DOWN"} ${st.name}</b><br>Swap Fee: $${st.cost_swap.toFixed(1)}<br>Coords: ${st.lat.toFixed(4)}, ${st.lng.toFixed(4)}`
    );
    marker.addTo(stationMarkersLayer);
  });

  // 2. Draw Real Road-Network Route Geometry (TomTom / OSRM GeoJSON)
  if (currentRoute && currentRoute.geometry && currentRoute.geometry.features && currentRoute.geometry.features.length > 0) {
    const stops = currentRoute.stops || [];
    currentRoute.geometry.features.forEach(feature => {
      const props = feature.properties || {};
      const fromStop = stops[props.from_sequence_index];
      const toStop = stops[props.to_sequence_index];
      const isFrozen = fromStop && toStop && fromStop.status === "done" && toStop.status === "done";

      const layer = L.geoJSON(feature, {
        style: {
          color: isFrozen ? "#10b981" : "#06b6d4",
          weight: isFrozen ? 3.5 : 5,
          opacity: isFrozen ? 0.75 : 0.95,
          dashArray: isFrozen ? "6, 6" : null,
        },
      });
      layer.addTo(routeLayer);
    });
  } else if (currentRoute && currentRoute.stops && currentRoute.stops.length > 1) {
    const latlngs = currentRoute.stops.map(s => [s.lat, s.lng]);
    L.polyline(latlngs, { color: "#06b6d4", weight: 3.5, opacity: 0.8, dashArray: "4, 6" }).addTo(routeLayer);
  }

  // 3. Draw Route Stop Nodes (Depot, Pickups, Deliveries)
  if (currentRoute && currentRoute.stops) {
    currentRoute.stops.forEach(stop => {
      if (stop.lat == null || stop.lng == null) return;
      const latlng = [stop.lat, stop.lng];
      boundsPoints.push(latlng);

      let icon, popup;
      if (stop.stop_type === "depot") {
        icon = stopDivIcon("depot", "D");
        popup = `<b>🏢 DEPOT</b><br>${stop.label || "Hanoi Hub"}`;
      } else if (stop.stop_type === "pickup") {
        icon = stopDivIcon("pickup", `P${stop.ref_order_id ?? ""}`);
        popup = `<b>📦 Pickup #${stop.ref_order_id}</b><br>Weight: ${stop.weight}kg<br>Load: ${stop.current_load}kg`;
      } else if (stop.stop_type === "delivery") {
        icon = stopDivIcon("delivery", `D${stop.ref_order_id ?? ""}`);
        popup = `<b>🏠 Delivery #${stop.ref_order_id}</b><br>Weight: ${stop.weight}kg<br>Load: ${stop.current_load}kg`;
      } else {
        return; // Swap stations are already rendered with live toggle
      }

      L.marker(latlng, { icon }).bindPopup(popup).addTo(stopMarkersLayer);
    });
  }

  // 4. Update Vehicle Marker
  updateVehicleMarker();

  if (!hasFitBounds && boundsPoints.length > 0) {
    map.fitBounds(boundsPoints, { padding: [40, 40] });
    hasFitBounds = true;
  }
}

// Log utility
function addLog(msg, type = "info") {
  const container = document.getElementById("event-logs");
  const time = new Date().toLocaleTimeString();
  const entry = document.createElement("div");
  entry.className = `log-entry ${type}`;
  entry.innerHTML = `<span class="log-time">[${time}]</span> ${msg}`;
  container.appendChild(entry);
  container.scrollTop = container.scrollHeight;
}

function clearLogs() {
  document.getElementById("event-logs").innerHTML = "";
}
