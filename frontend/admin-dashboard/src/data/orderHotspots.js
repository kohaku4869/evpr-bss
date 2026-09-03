// Mock order-density hotspots — dense residential/commercial clusters where
// delivery demand concentrates, for the map's "Đơn hàng" heatmap toggle.
// Same district spread as ROAD_CORRIDORS / the real station list.
export const ORDER_HOTSPOTS = [
  { id: 'vincom-ba-trieu', name: 'Vincom Bà Triệu', lat: 21.0135, lng: 105.8460, baseIntensity: 0.7 },
  { id: 'times-city', name: 'Times City', lat: 20.9955, lng: 105.8675, baseIntensity: 0.65 },
  { id: 'royal-city', name: 'Royal City', lat: 21.0035, lng: 105.8155, baseIntensity: 0.6 },
  { id: 'my-dinh', name: 'Mỹ Đình', lat: 21.0280, lng: 105.7720, baseIntensity: 0.55 },
  { id: 'cau-giay', name: 'Cầu Giấy', lat: 21.0340, lng: 105.8010, baseIntensity: 0.6 },
  { id: 'aeon-long-bien', name: 'Aeon Mall Long Biên', lat: 21.0260, lng: 105.9000, baseIntensity: 0.5 },
];
