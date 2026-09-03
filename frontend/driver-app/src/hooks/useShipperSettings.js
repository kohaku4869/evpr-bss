import { useCallback, useState } from 'react';

const STORAGE_KEY = 'shipper_settings_v1';

export const VEHICLE_TYPES = [
  { value: 'e-motorbike', label: 'Xe máy điện' },
  { value: 'e-bike', label: 'Xe đạp điện' },
  { value: 'e-car', label: 'Ô tô điện' },
];

const DEFAULT_SETTINGS = {
  vehicleType: 'e-motorbike',
  batteryCapacityKwh: 60,
  warningThresholdPercent: 20,
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (err) {
    console.error('Error loading shipper settings:', err);
    return DEFAULT_SETTINGS;
  }
}

// Local-only shipper preferences (vehicle type, battery capacity, low-battery
// warning threshold). There is no backend model for shipper profile/settings
// yet — same presentational tier as mockData.js's MOCK_DRIVER — so this
// persists to localStorage instead of an API.
export function useShipperSettings() {
  const [settings, setSettings] = useState(loadSettings);

  const updateSettings = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (err) {
        console.error('Error saving shipper settings:', err);
      }
      return next;
    });
  }, []);

  return { settings, updateSettings };
}
