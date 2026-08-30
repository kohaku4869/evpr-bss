import styles from './AlertsScreen.module.css';

export default function AlertsScreen({ alerts }) {
  if (!alerts.length) {
    return <div className={styles.list}><div className={styles.empty}>Chưa có thông báo nào.</div></div>;
  }

  return (
    <div className={styles.list}>
      {alerts.map((a) => (
        <div key={a.id} className={`${styles.entry} ${styles[a.type] || styles.info}`}>
          <span className={styles.time}>[{a.time}]</span>
          <span>{a.msg}</span>
        </div>
      ))}
    </div>
  );
}
