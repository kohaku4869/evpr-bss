// Illustrative mock figures for the analytics section — not a real costing
// engine, there's no backend model for this yet (see plan doc).
export const ENERGY_BY_VEHICLE_TYPE = [
  { type: 'Xe đạp điện', kwhPerKm: 0.018 },
  { type: 'Xe máy điện', kwhPerKm: 0.045 },
  { type: 'Ô tô điện', kwhPerKm: 0.16 },
];

export const EV_COST_PER_KM_VND = 450; // energy + swap fee, blended
export const GAS_COST_PER_KM_VND = 900; // traditional fuel equivalent
export const CO2_KG_SAVED_PER_KM = 0.09; // vs. an equivalent petrol vehicle
export const ASSUMED_FLEET_KM_TODAY = 680;
export const AVG_KM_PER_ORDER = 6;
export const ALLOWANCE_PER_ORDER_VND = 15000;
