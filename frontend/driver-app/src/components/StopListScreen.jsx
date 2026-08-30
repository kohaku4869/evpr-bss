import { STOP_TYPE_LABEL } from '../i18n';
import styles from './StopListScreen.module.css';

export default function StopListScreen({ route }) {
  if (!route?.stops?.length) {
    return <div className={styles.list}><div className={styles.empty}>Chưa có lộ trình nào.</div></div>;
  }

  const firstPendingIdx = route.stops.findIndex((s) => s.status === 'pending');

  return (
    <div className={styles.list}>
      {route.stops.map((stop, idx) => {
        const isDone = stop.status === 'done';
        const isActive = idx === firstPendingIdx;
        const statusLabel = isDone ? '✓ Xong' : (isActive ? '▶ Tiếp theo' : 'Chưa tới');

        return (
          <div key={`${stop.stop_type}-${stop.ref_order_id}-${stop.ref_station_id}-${idx}`}
               className={`${styles.item} ${isDone ? styles.done : (isActive ? styles.active : styles.pending)}`}>
            <div className={styles.left}>
              <span className={styles.seq}>#{stop.sequence_index}</span>
              <span className={`${styles.tag} ${styles[stop.stop_type] || ''}`}>{STOP_TYPE_LABEL[stop.stop_type] || stop.stop_type}</span>
              <span className={styles.label}>{stop.label || STOP_TYPE_LABEL[stop.stop_type]}</span>
            </div>
            <span className={styles.badge}>{statusLabel}</span>
          </div>
        );
      })}
    </div>
  );
}
