import L from 'leaflet';

// Same emoji/color-coded div-icon vocabulary as backend/app/static/app.js's
// stopDivIcon, so Driver Mode reads as a sibling of the admin dashboard.
export function stopDivIcon(cls, label, size = 24) {
  return L.divIcon({
    className: 'stop-divicon',
    html: `<div class="stop-pin stop-pin--${cls}">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// A battery-swap station gets its own ⚡ icon (not a plain colored dot) so its
// role reads clearly on the map. The one on the shipper's current route is
// bigger and pulses so it stands out from other nearby stations not in play.
export function stationDivIcon(isAvailable, isOnRoute = false) {
  const size = isOnRoute ? 30 : 22;
  const statusClass = isAvailable ? 'station-available' : 'station-down';
  return L.divIcon({
    className: 'stop-divicon',
    html: `<div class="stop-pin stop-pin--${statusClass}${isOnRoute ? ' stop-pin--station-onroute' : ''}">⚡</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export function vehicleDivIcon() {
  return L.divIcon({
    className: 'stop-divicon',
    html: `<div class="stop-pin stop-pin--vehicle">🛵</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}
