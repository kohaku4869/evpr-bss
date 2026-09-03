import styles from './FleetPanel.module.css';

const STATUS_LABEL = { driving: 'Đang chạy', idle: 'Rảnh', charging: 'Đang đổi pin' };

export default function FleetPanel({ shippers }) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>🛵 Đội xe ({shippers.length})</h2>
      </div>
      <div className={styles.list}>
        {shippers.map((s) => (
          <div key={s.id} className={styles.row}>
            <div className={styles.info}>
              <div className={styles.name}>{s.name}</div>
              <div className={styles.meta}>{s.vehicleType} · {STATUS_LABEL[s.status]}</div>
            </div>
            <div className={`${styles.battery} ${s.battery <= 20 ? styles.batteryLow : ''}`}>
              {Math.round(s.battery)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
