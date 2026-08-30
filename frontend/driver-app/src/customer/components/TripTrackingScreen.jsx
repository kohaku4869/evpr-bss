import { STATUS_STEPS } from '../statusSteps';
import { MOCK_MATCHED_DRIVER, SERVICE_LABEL, FOOD_RESTAURANTS } from '../mockCustomerData';
import CustomerMapPreview from './CustomerMapPreview';
import styles from './TripTrackingScreen.module.css';

export default function TripTrackingScreen({ order, statusIndex, onAdvance, onCancel }) {
  const steps = STATUS_STEPS[order.serviceType];
  const isLast = statusIndex >= steps.length - 1;
  const pickupLabel = order.serviceType === 'food'
    ? (FOOD_RESTAURANTS.find((r) => r.id === order.form.restaurantId)?.name || 'Quán ăn')
    : order.form.pickup;
  const dropoffLabel = order.form.dropoff;

  return (
    <div className={styles.wrap}>
      <div className={styles.mapBox}>
        <CustomerMapPreview
          pickupLabel={pickupLabel}
          dropoffLabel={dropoffLabel}
          progress={statusIndex / (steps.length - 1)}
        />
      </div>

      <div className={styles.body}>
        <div className={styles.driverCard}>
          <div className={styles.avatar}>{MOCK_MATCHED_DRIVER.avatarInitials}</div>
          <div className={styles.driverInfo}>
            <div className={styles.driverName}>{MOCK_MATCHED_DRIVER.name}</div>
            <div className={styles.driverMeta}>⭐ {MOCK_MATCHED_DRIVER.rating} · {MOCK_MATCHED_DRIVER.vehiclePlate}</div>
          </div>
          <div className={styles.driverActions}>
            <button className={styles.iconBtn} aria-label="Gọi tài xế">📞</button>
            <button className={styles.iconBtn} aria-label="Nhắn tin">💬</button>
          </div>
        </div>

        <div className={styles.timeline}>
          {steps.map((label, idx) => (
            <div key={label} className={`${styles.step} ${idx <= statusIndex ? styles.done : ''}`}>
              <span className={styles.dot} />
              <span>{label}</span>
            </div>
          ))}
        </div>

        <div className={styles.summary}>
          <div>Loại dịch vụ: {SERVICE_LABEL[order.serviceType]}</div>
          {order.serviceType === 'package' && <div>Khối lượng: {order.form.weight} kg</div>}
          {order.serviceType === 'ride' && <div>Số khách: {order.form.passengers || 1}</div>}
          <div>Cước phí: {order.fare}</div>
        </div>

        <button className={styles.advanceBtn} onClick={onAdvance}>
          {isLast ? 'Hoàn tất đơn' : 'Cập nhật trạng thái'}
        </button>
        {!isLast && (
          <button className={styles.cancelBtn} onClick={onCancel}>Hủy đơn</button>
        )}
      </div>
    </div>
  );
}
