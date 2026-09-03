import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ENERGY_BY_VEHICLE_TYPE, EV_COST_PER_KM_VND, GAS_COST_PER_KM_VND, ASSUMED_FLEET_KM_TODAY } from '../data/energyAssumptions';
import { BATTERY_CYCLE_MAINTENANCE_THRESHOLD } from '../data/mockFleet';
import styles from './EnergyAnalyticsSection.module.css';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipLabel}>{label}</div>
      <div>{payload[0].value} {payload[0].unit}</div>
    </div>
  );
}

export default function EnergyAnalyticsSection({ shippers }) {
  const evCostToday = ASSUMED_FLEET_KM_TODAY * EV_COST_PER_KM_VND;
  const gasCostToday = ASSUMED_FLEET_KM_TODAY * GAS_COST_PER_KM_VND;
  const savedToday = gasCostToday - evCostToday;
  const savedPct = Math.round((savedToday / gasCostToday) * 100);

  const soHRows = [...shippers].sort((a, b) => b.batteryCycles - a.batteryCycles);

  return (
    <div className={styles.grid}>
      <div className={styles.card}>
        <div className={styles.cardTitle}>⚡ Tiêu thụ năng lượng theo loại xe</div>
        <div className={styles.chartBox}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ENERGY_BY_VEHICLE_TYPE} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="type" stroke="var(--text-dim)" fontSize={11} />
              <YAxis stroke="var(--text-dim)" fontSize={11} unit=" kWh/km" width={70} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="kwhPerKm" unit=" kWh/km" fill="#14b8a6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>💰 So sánh chi phí vận hành (ước tính hôm nay)</div>
        <div className={styles.tcoRow}>
          <div className={styles.tcoBox}>
            <span className={styles.tcoLabel}>Xe điện (EVPR-BSS)</span>
            <span className={styles.tcoValue}>{evCostToday.toLocaleString('vi-VN')}đ</span>
          </div>
          <div className={styles.tcoBox}>
            <span className={styles.tcoLabel}>Xe xăng tương đương</span>
            <span className={styles.tcoValueMuted}>{gasCostToday.toLocaleString('vi-VN')}đ</span>
          </div>
        </div>
        <div className={styles.savedBanner}>
          Tiết kiệm <b>{savedToday.toLocaleString('vi-VN')}đ</b> ({savedPct}%) so với đội xe xăng cùng quãng đường
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>🔋 Vòng đời pin (SoH) theo xe</div>
        <div className={styles.sohList}>
          {soHRows.map((s) => {
            const pct = Math.min(100, Math.round((s.batteryCycles / BATTERY_CYCLE_MAINTENANCE_THRESHOLD) * 100));
            const dueForMaintenance = s.batteryCycles >= BATTERY_CYCLE_MAINTENANCE_THRESHOLD;
            return (
              <div key={s.id} className={styles.sohRow}>
                <div className={styles.sohInfo}>
                  <span className={styles.sohName}>{s.name}</span>
                  <span className={styles.sohCycles}>{s.batteryCycles} chu kỳ{dueForMaintenance ? ' — cần bảo dưỡng' : ''}</span>
                </div>
                <div className={styles.sohTrack}>
                  <div
                    className={`${styles.sohFill} ${dueForMaintenance ? styles.sohFillDue : ''}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
