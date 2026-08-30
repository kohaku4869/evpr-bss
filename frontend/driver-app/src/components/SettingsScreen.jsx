import { useState } from 'react';
import SubScreenHeader from './SubScreenHeader';
import styles from './SettingsScreen.module.css';

function Switch({ on, onToggle }) {
  return (
    <button className={`${styles.switch} ${on ? styles.on : ''}`} onClick={onToggle} aria-pressed={on}>
      <span className={styles.switchThumb} />
    </button>
  );
}

export default function SettingsScreen({ onBack }) {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  return (
    <div className={styles.wrap}>
      <SubScreenHeader title="Cài đặt" onBack={onBack} />
      <div className={styles.content}>
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
