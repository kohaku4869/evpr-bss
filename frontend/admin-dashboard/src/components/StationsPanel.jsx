import styles from './StationsPanel.module.css';

function loadClass(load) {
  if (load >= 75) return styles.critical;
  if (load >= 50) return styles.warning;
  return styles.ok;
}

export default function StationsPanel({ stations }) {
  const sorted = [...stations].sort((a, b) => b.load - a.load);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>🔋 Trạm đổi pin ({stations.length})</h2>
      </div>
      <div className={styles.list}>
        {sorted.map((s) => (
          <div key={s.id} className={`${styles.row} ${s.overloaded ? styles.overloadedRow : ''}`}>
            <div className={styles.info}>
              <div className={styles.name}>{s.name}</div>
              <div className={styles.barTrack}>
                <div className={`${styles.barFill} ${loadClass(s.load)}`} style={{ width: `${s.load}%` }} />
              </div>
            </div>
            <div className={styles.loadValue}>{s.load}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}
