import styles from './StatusHeader.module.css';

const WS_LABEL = {
  connected: 'Đang hoạt động',
  connecting: 'Đang kết nối…',
  reconnecting: 'Đang kết nối lại…',
};

export default function StatusHeader({ wsStatus, batteryPercent, batteryKwh, load }) {
  const isLow = batteryPercent != null && batteryPercent <= 15;

  return (
    <header className={styles.header}>
      <span className={`${styles.wsBadge} ${styles[wsStatus] || ''}`}>
        <span className={styles.dot} />
        {WS_LABEL[wsStatus] || wsStatus}
      </span>

      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Pin (đến trạm kế)</span>
          <span className={`${styles.metricValue} ${isLow ? styles.batteryLow : ''}`}>
            {batteryPercent != null ? `${batteryPercent}%` : '--'} {batteryKwh != null ? `(${batteryKwh}kWh)` : ''}
          </span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Tải trọng</span>
          <span className={styles.metricValue}>{load != null ? `${load}kg` : '--'}</span>
        </div>
      </div>
    </header>
  );
}
