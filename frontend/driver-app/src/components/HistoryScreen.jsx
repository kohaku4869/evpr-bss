import { MOCK_TRIP_HISTORY } from '../mockData';
import SubScreenHeader from './SubScreenHeader';
import styles from './HistoryScreen.module.css';

export default function HistoryScreen({ onBack }) {
  return (
    <div className={styles.wrap}>
      <SubScreenHeader title="Lịch sử chuyến" onBack={onBack} />
      <div className={styles.list}>
        {MOCK_TRIP_HISTORY.map((trip) => {
          const isDone = trip.status === 'Hoàn thành';
          return (
            <div key={trip.id} className={styles.card}>
              <div>
                <div className={styles.date}>{trip.date}</div>
                <div className={styles.detail}>{trip.stopsCount} điểm dừng · {trip.distanceKm} km</div>
              </div>
              <span className={`${styles.status} ${isDone ? styles.done : styles.canceled}`}>{trip.status}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
