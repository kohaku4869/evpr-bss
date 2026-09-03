import L from 'leaflet';

const STATUS_EMOJI = { driving: '🛵', idle: '🅿️', charging: '⚡', maintenance: '🔧' };

export function shipperDivIcon(status) {
  return L.divIcon({
    className: 'shipper-divicon',
    html: `<div class="shipper-pin shipper-pin--${status}">${STATUS_EMOJI[status] || '🛵'}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}
