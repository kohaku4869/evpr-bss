// Simulated fleet — the backend only tracks a single real shipper (id 1,
// see frontend/driver-app), so a multi-driver fleet view has to be mocked
// entirely client-side for this dashboard. Seeded near real Hanoi districts
// so positions look plausible next to the real station markers.
//
// Only two-wheelers here: real BSS battery-swap cabinets are sized for
// e-motorbike/e-bike packs, not EV car batteries (those charge via a plug,
// not a swap cabinet) — so "Ô tô điện" doesn't fit this system's model and
// was dropped rather than kept-but-excluded, per team direction.
export const VEHICLE_TYPES = ['Xe máy điện', 'Xe đạp điện'];

// Cycle count above this is flagged "cần bảo dưỡng" in the SoH view (li-ion
// packs used in these vehicles are rated ~1000 cycles before capacity fade
// becomes noticeable — a plausible mock threshold, not a real spec).
export const BATTERY_CYCLE_MAINTENANCE_THRESHOLD = 800;

const FLEET_SIZE = 24;

// A handful of named "anchor" drivers kept stable across reloads (referenced
// in prior demo runs/screenshots); the rest are generated to fill out the
// fleet to FLEET_SIZE without hand-writing dozens of entries.
const ANCHOR_SHIPPERS = [
  { id: 101, name: 'Nguyễn Văn Long', plate: '29-AB1 234.56', lat: 21.0250, lng: 105.8480, battery: 82, status: 'driving', rating: 4.8, completedOrdersToday: 14, batteryCycles: 320 },
  { id: 102, name: 'Trần Thị Hoa', plate: '29-AC2 118.02', lat: 21.0140, lng: 105.8340, battery: 45, status: 'driving', rating: 4.6, completedOrdersToday: 11, batteryCycles: 540 },
  { id: 103, name: 'Phạm Minh Đức', plate: '30-F1 552.19', lat: 20.9990, lng: 105.8090, battery: 61, status: 'driving', rating: 4.9, completedOrdersToday: 17, batteryCycles: 210 },
  { id: 104, name: 'Lê Thị Mai', plate: '29-AB3 087.44', lat: 21.0340, lng: 105.8010, battery: 28, status: 'driving', rating: 4.5, completedOrdersToday: 9, batteryCycles: 890 },
  { id: 105, name: 'Hoàng Văn Nam', plate: '29-AC1 903.71', lat: 21.0598, lng: 105.8175, battery: 95, status: 'idle', rating: 4.7, completedOrdersToday: 6, batteryCycles: 150 },
  { id: 106, name: 'Vũ Thị Lan', plate: '29-AB2 465.30', lat: 20.9670, lng: 105.8310, battery: 52, status: 'maintenance', rating: 4.4, completedOrdersToday: 3, batteryCycles: 970 },
  { id: 107, name: 'Đặng Quốc Anh', plate: '30-G1 271.88', lat: 21.0432, lng: 105.8837, battery: 18, status: 'driving', rating: 4.6, completedOrdersToday: 13, batteryCycles: 610 },
  { id: 108, name: 'Bùi Thị Thu', plate: '29-AC3 640.15', lat: 21.0280, lng: 105.7720, battery: 70, status: 'charging', rating: 4.8, completedOrdersToday: 12, batteryCycles: 405 },
];

const SURNAMES = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
const MIDDLE_NAMES = ['Văn', 'Hữu', 'Đức', 'Minh', 'Quốc', 'Thành', 'Thị', 'Ngọc', 'Thu', 'Kim', 'Hồng', 'Anh'];
const GIVEN_NAMES = ['Long', 'Hoa', 'Đức', 'Mai', 'Nam', 'Lan', 'Anh', 'Thu', 'Hùng', 'Trang', 'Tùng', 'Hương', 'Quang', 'Linh', 'Sơn', 'Nga', 'Dũng', 'Hiền', 'Khoa', 'Yến', 'Đạt', 'Thảo', 'Phong', 'Vy'];
const PLATE_LETTERS = ['AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH'];
// Weighted so most of the fleet is out driving, matching a normal shift mix.
const STATUS_POOL = ['driving', 'driving', 'driving', 'driving', 'driving', 'idle', 'charging', 'maintenance'];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomName() {
  return `${pick(SURNAMES)} ${pick(MIDDLE_NAMES)} ${pick(GIVEN_NAMES)}`;
}

function randomPlate() {
  const prefix = pick(['29', '30']);
  const letters = pick(PLATE_LETTERS);
  const digit = 1 + Math.floor(Math.random() * 9);
  const num1 = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  const num2 = String(Math.floor(Math.random() * 100)).padStart(2, '0');
  return `${prefix}-${letters}${digit} ${num1}.${num2}`;
}

// Same Hanoi urban bounding box useSimulatedFleet.js clamps live jitter to.
function randomHanoiPosition() {
  return {
    lat: 20.90 + Math.random() * 0.20,
    lng: 105.70 + Math.random() * 0.25,
  };
}

function generateShipper(id) {
  return {
    id,
    name: randomName(),
    plate: randomPlate(),
    ...randomHanoiPosition(),
    battery: Math.round(15 + Math.random() * 85),
    status: pick(STATUS_POOL),
    rating: Math.round((4.2 + Math.random() * 0.7) * 10) / 10,
    completedOrdersToday: Math.floor(Math.random() * 18),
    batteryCycles: Math.floor(100 + Math.random() * 950),
  };
}

const generatedCount = Math.max(0, FLEET_SIZE - ANCHOR_SHIPPERS.length);
const GENERATED_SHIPPERS = Array.from({ length: generatedCount }, (_, i) => generateShipper(109 + i));

export const MOCK_SHIPPERS = [...ANCHOR_SHIPPERS, ...GENERATED_SHIPPERS]
  .map((s, i) => ({ ...s, vehicleType: VEHICLE_TYPES[i % VEHICLE_TYPES.length] }));
