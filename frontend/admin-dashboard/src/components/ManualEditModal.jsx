import { useState } from 'react';
import styles from './ManualEditModal.module.css';

// Two modes: reused from a suggestion group (station reassignment for every
// affected driver) when `suggestion` is set, or standalone ad-hoc dispatch
// ("Điều phối thủ công" button, no suggestion behind it) when it's null —
// the latter also needs a driver picker since there's no group to imply one.
export default function ManualEditModal({ suggestion, stations, shippers, onConfirm, onCancel }) {
  const isAdHoc = !suggestion;
  const alternativeStations = stations
    .filter((s) => s.is_available)
    .sort((a, b) => a.load - b.load);
  const activeShippers = (shippers || []).filter((s) => s.status === 'driving');

  const [targetStationId, setTargetStationId] = useState(
    suggestion?.proposedStationId ?? alternativeStations[0]?.id ?? ''
  );
  const [targetShipperId, setTargetShipperId] = useState(activeShippers[0]?.id ?? '');
  const [note, setNote] = useState('');

  const handleConfirm = () => {
    const station = stations.find((s) => s.id === Number(targetStationId));
    const shipper = isAdHoc ? activeShippers.find((s) => s.id === Number(targetShipperId)) : null;
    const target = station ? `sang ${station.name}` : '';
    const who = shipper ? `điều ${shipper.name} ${target}` : `điều xe ${target}`;
    const summary = `Chỉ định thủ công: ${who}${note ? ` — ${note}` : ''}`;
    onConfirm(summary);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.sheet}>
        <div className={styles.title}>{isAdHoc ? 'Điều phối thủ công' : 'Chỉnh thủ công'}</div>
        <div className={styles.desc}>{suggestion?.title || 'Chỉ định trực tiếp một tài xế, không qua gợi ý AI.'}</div>

        {isAdHoc && (
          <>
            <label className={styles.label} htmlFor="target-shipper">Tài xế</label>
            <select
              id="target-shipper"
              className={styles.select}
              value={targetShipperId}
              onChange={(e) => setTargetShipperId(e.target.value)}
            >
              {activeShippers.map((s) => (
                <option key={s.id} value={s.id}>{s.name} — {Math.round(s.battery)}% pin</option>
              ))}
            </select>
          </>
        )}

        <label className={styles.label} htmlFor="target-station">Trạm đổi pin chỉ định</label>
        <select
          id="target-station"
          className={styles.select}
          value={targetStationId}
          onChange={(e) => setTargetStationId(e.target.value)}
        >
          {alternativeStations.map((s) => (
            <option key={s.id} value={s.id}>{s.name} — {s.load}% tải</option>
          ))}
        </select>

        <label className={styles.label} htmlFor="note">Ghi chú cho tài xế (tuỳ chọn)</label>
        <textarea
          id="note"
          className={styles.textarea}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="VD: Ưu tiên giao đơn gần trước khi ghé trạm..."
          rows={3}
        />

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onCancel}>Huỷ</button>
          <button className={styles.confirmBtn} onClick={handleConfirm}>Xác nhận chỉ định</button>
        </div>
      </div>
    </div>
  );
}
