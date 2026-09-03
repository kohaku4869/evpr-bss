// Cosmetic-only mock fields for NextStopCard's Grab-style layout — the
// backend's Order model only has lat/lng/weight (no street address, contact
// note, or fee), so these are fabricated for a closer visual match. Purely
// presentational, deterministic per stop (seeded off its id) so it doesn't
// change every re-render.
const DISTRICTS = ['Cầu Giấy', 'Đống Đa', 'Hai Bà Trưng', 'Ba Đình', 'Hoàn Kiếm', 'Thanh Xuân', 'Tây Hồ', 'Hoàng Mai', 'Long Biên', 'Nam Từ Liêm'];
const STREETS = ['Lê Văn Lương', 'Nguyễn Trãi', 'Giải Phóng', 'Trần Duy Hưng', 'Xã Đàn', 'Láng', 'Cầu Giấy', 'Kim Mã', 'Lạc Long Quân', 'Nguyễn Chí Thanh', 'Hoàng Quốc Việt', 'Tôn Đức Thắng'];

function seedFor(stop) {
  return stop.ref_order_id ?? stop.ref_station_id ?? stop.sequence_index ?? 0;
}

export function mockAddressFor(stop) {
  const seed = seedFor(stop);
  const houseNo = 10 + ((seed * 17) % 300);
  const street = STREETS[seed % STREETS.length];
  const district = DISTRICTS[(seed * 3) % DISTRICTS.length];
  return `Số ${houseNo}, ${street}, Q. ${district}, Hà Nội`;
}

export function mockContactNoteFor(stop) {
  if (stop.stop_type === 'pickup') return 'Nhớ gọi trước cho người gửi';
  if (stop.stop_type === 'delivery') return 'Nhớ gọi trước cho người nhận';
  return null;
}

export function mockFeeFor(stop) {
  const weight = stop.weight ?? 1;
  const base = Math.round((weight * 8000 + 12000) / 1000) * 1000;
  const tip = 2000;
  return { base, tip };
}

export function mockPaymentMethodFor(stop) {
  return seedFor(stop) % 2 === 0 ? 'Tiền mặt' : 'Thẻ/Ví';
}

export function formatVnd(amount) {
  return `${amount.toLocaleString('vi-VN')}đ`;
}

export function googleMapsDirectionsUrl(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
