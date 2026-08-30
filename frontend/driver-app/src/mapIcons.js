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

export function vehicleDivIcon() {
  return L.divIcon({
    className: 'stop-divicon',
    html: `<div class="stop-pin stop-pin--vehicle">🛵</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}
