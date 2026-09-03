import { useState } from 'react';
import SubScreenHeader from './SubScreenHeader';
import { VEHICLE_TYPES } from '../hooks/useShipperSettings';
import styles from './SettingsScreen.module.css';

function Switch({ on, onToggle }) {
  return (
    <button className={`${styles.switch} ${on ? styles.on : ''}`} onClick={onToggle} aria-pressed={on}>
      <span className={styles.switchThumb} />
    </button>
  );
}

export default function SettingsScreen({ onBack, settings, onUpdateSettings }) {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  return (
    <div className={styles.wrap}>
      <SubScreenHeader title="Cài đặt" onBack={onBack} />
      <div className={styles.content}>
        <div className={styles.menu}>
          <div className={styles.row}>
            <span>Loại xe</span>
            <select
              className={styles.select}
              value={settings.vehicleType}
              onChange={(e) => onUpdateSettings({ vehicleType: e.target.value })}
            >
              {VEHICLE_TYPES.map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          </div>
          <div className={styles.row}>
            <span>Dung lượng pin (kWh)</span>
            <input
              type="number"
              min="1"
              step="1"
              className={styles.numberInput}
              value={settings.batteryCapacityKwh}
              onChange={(e) => onUpdateSettings({ batteryCapacityKwh: Number(e.target.value) || 0 })}
            />
          </div>
          <div className={styles.row}>
            <span>Ngưỡng cảnh báo pin yếu (%)</span>
            <input
              type="number"
              min="1"
              max="99"
              step="1"
              className={styles.numberInput}
              value={settings.warningThresholdPercent}
              onChange={(e) => onUpdateSettings({ warningThresholdPercent: Number(e.target.value) || 0 })}
            />
          </div>
        </div>

        <div className={styles.menu}>
          <div className={styles.row}>
            <span>Thông báo đẩy</span>
            <Switch on={pushEnabled} onToggle={() => setPushEnabled((v) => !v)} />
          </div>
          <div className={styles.row}>
            <span>Âm thanh cảnh báo</span>
            <Switch on={soundEnabled} onToggle={() => setSoundEnabled((v) => !v)} />
          </div>
        </div>

        <div className={styles.menu}>
          <div className={styles.row}>
            <span>Ngôn ngữ</span>
            <span className={styles.rowValue}>Tiếng Việt</span>
          </div>
          <div className={styles.row}>
            <span>Phiên bản ứng dụng</span>
            <span className={styles.rowValue}>1.0.0</span>
          </div>
          <div className={styles.row}>
            <span>Điều khoản sử dụng</span>
            <span className={styles.rowValue}>›</span>
          </div>
        </div>
      </div>
    </div>
  );
}
