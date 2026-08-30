import { SERVICE_LABEL } from '../mockCustomerData';
import styles from './OrdersScreen.module.css';

export default function OrdersScreen({ activeOrder, history, onViewActive }) {
  return (
    <div className={styles.wrap}>
      {activeOrder && (
        <button className={styles.activeCard} onClick={onViewActive}>
          <div>
            <div className={styles.activeTitle}>Đơn đang diễn ra</div>
            <div className={styles.activeDetail}>{SERVICE_LABEL[activeOrder.serviceType]} · {activeOrder.fare}</div>
          </div>
          <span>›</span>
        </button>
      )}

      {history.length === 0 && !activeOrder && (
        <div className={styles.empty}>Bạn chưa có đơn hàng nào.</div>
      )}

      {history.map((o) => {
        const isDone = o.status === 'Hoàn thành';
        return (
          <div key={o.id} className={styles.card}>
            <div>
              <div className={styles.cardTitle}>{SERVICE_LABEL[o.type]}</div>
              <div className={styles.cardDetail}>{o.summary}</div>
              <div className={styles.cardDate}>{o.date}</div>
            </div>
            <div className={styles.cardRight}>
              <div className={styles.fare}>{o.fare}</div>
              <span className={`${styles.status} ${isDone ? styles.done : styles.canceled}`}>{o.status}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
