import { useState } from 'react';
import styles from './StationIncidentPanel.module.css';

// Reads real station status (GET /stations) and writes it back through the
// same PATCH /stations/{id}/status the /demo dashboard already uses — the
// only genuinely backend-connected action in this dashboard (see plan doc).
export default function StationIncidentPanel({ stations, onToggle }) {
  const [selectedId, setSelectedId] = useState('');
  const [pendingId, setPendingId] = useState(null);

  const availableStations = stations.filter((s) => s.is_available);
  const downStations = stations.filter((s) => !s.is_available);

  const handleLock = async () => {
    if (!selectedId) return;
    setPendingId(selectedId);
    await onToggle(Number(selectedId), false);
    setPendingId(null);
    setSelectedId('');
  };

  const handleReopen = async (id) => {
    setPendingId(id);
    await onToggle(id, true);
    setPendingId(null);
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>🚧 Sự cố trạm pin ({downStations.length})</h2>
      </div>

      <div className={styles.lockRow}>
        <select className={styles.select} value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          <option value="">Chọn trạm để khoá luồng điều hướng...</option>
          {availableStations.map((s) => (
            <option key={s.id} value={s.id}>{s.name} — {s.load}% tải</option>
          ))}
        </select>
        <button className={styles.lockBtn} disabled={!selectedId || pendingId} onClick={handleLock}>
          Khoá luồng
        </button>
      </div>

      <div className={styles.list}>
        {downStations.length === 0 && (
          <div className={styles.empty}>Không có trạm nào đang gặp sự cố.</div>
        )}
        {downStations.map((s) => (
          <div key={s.id} className={styles.row}>
            <div className={styles.info}>
              <div className={styles.name}>{s.name}</div>
              <div className={styles.meta}>⚠️ Ngưng hoạt động</div>
            </div>
            <button
              className={styles.reopenBtn}
              disabled={pendingId === s.id}
              onClick={() => handleReopen(s.id)}
            >
              {pendingId === s.id ? '...' : 'Mở lại'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
