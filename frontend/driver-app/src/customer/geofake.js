// Deterministic fake geocoder: turns a free-text address into a plausible
// Hanoi coordinate, purely so the customer map preview has two distinct pins
// to draw. There is no real geocoding service behind the customer flow.
const HANOI_BOUNDS = { latMin: 20.990, latMax: 21.060, lngMin: 105.770, lngMax: 105.880 };

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function fakeGeocode(label, salt = '') {
  const h = hashString(`${label || 'diem-mac-dinh'}|${salt}`);
  const latFrac = (h % 1000) / 1000;
  const lngFrac = (Math.floor(h / 1000) % 1000) / 1000;
  return [
    HANOI_BOUNDS.latMin + latFrac * (HANOI_BOUNDS.latMax - HANOI_BOUNDS.latMin),
    HANOI_BOUNDS.lngMin + lngFrac * (HANOI_BOUNDS.lngMax - HANOI_BOUNDS.lngMin),
  ];
}
