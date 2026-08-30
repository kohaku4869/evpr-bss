import { useState } from 'react';
import { STOP_TYPE_LABEL } from '../i18n';
import styles from './NextStopCard.module.css';

const STATUS_LABEL = {
  driving: 'Đang di chuyển…',
  arrived: 'Đã đến nơi',
  finished: 'Đã hoàn thành chuyến',
  idle: 'Chưa có lộ trình',
};

export default function NextStopCard({ phase, targetStop, onComplete }) {
  const [completing, setCompleting] = useState(false);

  if (phase === 'idle') {
    return (
      <div className={styles.card}>
        <div className={styles.emptyCard}>Chưa có lộ trình nào đang hoạt động.</div>
      </div>
    );
  }

  if (phase === 'finished' || !targetStop) {
    return (
      <div className={styles.card}>
        <div className={styles.emptyCard}>🏁 Đã hoàn thành chuyến đi! Tất cả đơn hàng đã được giao.</div>
      </div>
    );
  }

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await onComplete();
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className={`${styles.card} ${phase === 'arrived' ? styles.arrived : ''}`}>
      <div className={styles.row}>
        <div className={styles.info}>
          <span className={`${styles.tag} ${styles[targetStop.stop_type] || ''}`}>{STOP_TYPE_LABEL[targetStop.stop_type] || targetStop.stop_type}</span>
          <div className={styles.label}>#{targetStop.sequence_index} {targetStop.label || STOP_TYPE_LABEL[targetStop.stop_type]}</div>
          <div className={styles.status}>{STATUS_LABEL[phase]}</div>
        </div>
        {phase === 'arrived' && (
          <button className={styles.completeBtn} disabled={completing} onClick={handleComplete}>
            {completing ? '...' : 'Hoàn thành điểm này'}
          </button>
        )}
      </div>
    </div>
  );
}
