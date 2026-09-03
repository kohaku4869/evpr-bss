import { useMemo, useState } from 'react';
import { SLOTS_PER_STATION } from '../hooks/useSimulatedFleet';
import styles from './StationsSection.module.css';

function slotColorClass(slot) {
  if (slot.status === 'empty') return styles.slotEmpty;
  if (slot.chargePercent >= 95) return styles.slotFull;
  if (slot.chargePercent >= 60) return styles.slotOk;
  if (slot.chargePercent >= 20) return styles.slotWarning;
  return styles.slotCritical;
}

function loadBadgeClass(station) {
  if (station.overloaded) return styles.loadCritical;
  if (station.load >= 50) return styles.loadWarning;
  return styles.loadOk;
}

function StationCard({ station, onToggleStation }) {
  const [pending, setPending] = useState(false);

  const handleToggle = async () => {
    setPending(true);
    await onToggleStation(station.id, !station.is_available);
    setPending(false);
  };

  return (
    <div className={`${styles.card} ${station.overloaded ? styles.cardOverloaded : ''}`}>
      <div className={styles.cardHeader}>
        <div className={styles.cardTitleGroup}>
          <div className={styles.name}>{station.name}</div>
          <div className={styles.status}>{station.is_available ? 'Hoạt động' : '⚠️ Ngưng hoạt động'}</div>
        </div>
        <span className={`${styles.loadBadge} ${loadBadgeClass(station)}`}>{station.load}%</span>
      </div>

      <div className={styles.summaryRow}>
        <span>Sẵn sàng <b>{station.availableBatteries}</b>/{SLOTS_PER_STATION}</span>
        <span>Đang sạc <b>{station.chargingBatteries}</b>/{SLOTS_PER_STATION}</span>
        {station.emptyBatteries > 0 && <span>Trống <b>{station.emptyBatteries}</b></span>}
      </div>

      <div className={styles.slotGrid}>
        {station.slots.map((slot, i) => (
          <div
            key={i}
            className={styles.slotTrack}
            title={slot.status === 'empty' ? 'Trống — chưa có pin' : `${slot.chargePercent}% ${slot.status === 'full' ? '(sẵn sàng)' : '(đang sạc)'}`}
          >
            <div
              className={`${styles.slotFill} ${slotColorClass(slot)}`}
              style={{ height: `${slot.status === 'empty' ? 6 : Math.max(8, slot.chargePercent)}%` }}
            />
          </div>
        ))}
      </div>

      <button className={styles.toggleBtn} disabled={pending} onClick={handleToggle}>
        {pending ? '...' : station.is_available ? 'Khoá luồng điều hướng' : 'Mở lại'}
      </button>
    </div>
  );
}

export default function StationsSection({ stations, onToggleStation }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'overloaded' | 'normal'

  const overloadedCount = stations.filter((s) => s.overloaded).length;

  const filtered = useMemo(() => {
    return stations
      .filter((s) => search.trim() === '' || s.name.toLowerCase().includes(search.toLowerCase()))
      .filter((s) => filter === 'all' || (filter === 'overloaded' ? s.overloaded : !s.overloaded))
      .sort((a, b) => b.load - a.load);
  }, [stations, search, filter]);

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h2 className={styles.title}>🔋 Trạm đổi pin ({stations.length})</h2>
      </div>

      <div className={styles.filterBar}>
        <input
          className={styles.search}
          placeholder="🔍 Tìm theo tên trạm..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className={styles.chips}>
          <button className={`${styles.chip} ${filter === 'all' ? styles.chipActive : ''}`} onClick={() => setFilter('all')}>
            Tất cả
          </button>
          <button className={`${styles.chip} ${filter === 'overloaded' ? styles.chipActive : ''}`} onClick={() => setFilter('overloaded')}>
            Quá tải ({overloadedCount})
          </button>
          <button className={`${styles.chip} ${filter === 'normal' ? styles.chipActive : ''}`} onClick={() => setFilter('normal')}>
            Bình thường
          </button>
        </div>
      </div>

      <div className={styles.grid}>
        {filtered.map((s) => (
          <StationCard key={s.id} station={s} onToggleStation={onToggleStation} />
        ))}
        {filtered.length === 0 && (
          <div className={styles.empty}>Không tìm thấy trạm phù hợp.</div>
        )}
      </div>
    </div>
  );
}
