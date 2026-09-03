import { useEffect, useState } from 'react';

const TICK_MS = 5000;

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function step(value, delta, min, max) {
  return clamp(value + (Math.random() - 0.5) * delta, min, max);
}

// No order model exists in the backend yet (see plan doc) — this mocks the
// order/SLA KPI block entirely client-side. avgCongestion biases at-risk
// orders so the number reads as connected to the map, not arbitrary noise.
export function useSimulatedOrders(avgCongestion) {
  const [totalOrdersToday, setTotalOrdersToday] = useState(214);
  const [onTimeRate, setOnTimeRate] = useState(97.4);
  const [atRiskOrders, setAtRiskOrders] = useState(3);

  useEffect(() => {
    const interval = setInterval(() => {
      setTotalOrdersToday((prev) => prev + (Math.random() < 0.6 ? 1 : 0));
      setOnTimeRate((prev) => Math.round(step(prev, 0.6, 92, 99.5) * 10) / 10);

      const congestionPressure = (avgCongestion ?? 50) / 100;
      setAtRiskOrders((prev) => Math.round(clamp(step(prev, 2, 0, 14) + congestionPressure, 0, 14)));
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [avgCongestion]);

  return { totalOrdersToday, onTimeRate, atRiskOrders };
}
