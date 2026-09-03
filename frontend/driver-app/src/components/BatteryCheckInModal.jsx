import { useState } from 'react';
import styles from './BatteryCheckInModal.module.css';

// Self-reported battery % at a fixed daily checkpoint — the future training
// signal for "1.2 Phân hệ Dự đoán Mức độ Hao hụt Pin Thực tế bằng Học máy".
// Stored to localStorage only for now (see useBatteryCheckIn.js).
export default function BatteryCheckInModal({ checkpoint, predictedPercent, vehicleType, batteryCapacityKwh, onSubmit, onSkip }) {
  const [value, setValue] = useState(predictedPercent ?? 50);

  return (
    <div className={styles.overlay}>
      <div className={styles.sheet}>
        <div className={styles.icon}>🔋</div>
        <div className={styles.title}>Kiểm tra mức pin lúc {checkpoint}</div>
        <div className={styles.desc}>
          Pin xe thực tế hiện còn bao nhiêu %? Thông tin này giúp hệ thống dự đoán mức hao pin chính xác hơn.
          {predictedPercent != null && (
            <> Hệ thống ước tính: <b>{predictedPercent}%</b>.</>
          )}
        </div>

        <div className={styles.sliderRow}>
          <input
            type="range"
            min="0"
            max="100"
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            className={styles.slider}
          />
          <span className={styles.value}>{value}%</span>
        </div>

        <div className={styles.actions}>
          <button className={styles.skipBtn} onClick={onSkip}>Bỏ qua</button>
          <button
            className={styles.submitBtn}
            onClick={() => onSubmit({ reportedPercent: value, predictedPercent, vehicleType, batteryCapacityKwh })}
          >
            Gửi
          </button>
        </div>
      </div>
    </div>
  );
}
