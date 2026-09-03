import { useEffect, useState } from 'react';
import styles from './TopBar.module.css';

function formatClock(d) {
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function TopBar({ lastUpdated }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className={styles.bar}>
      <div className={styles.brand}>
        <span className={styles.logo}>⚡</span>
        <div>
          <div className={styles.title}>EVPR-BSS Ops Dashboard</div>
          <div className={styles.subtitle}>Giám sát đội xe theo thời gian thực</div>
        </div>
      </div>

      <div className={styles.status}>
        <span className={styles.liveBadge}>
          <span className={styles.dot} />
          Live (mô phỏng)
        </span>
        <span className={styles.updatedAt}>Cập nhật lúc {formatClock(lastUpdated)}</span>
        <span className={styles.clock}>{formatClock(now)}</span>
      </div>
    </header>
  );
}
