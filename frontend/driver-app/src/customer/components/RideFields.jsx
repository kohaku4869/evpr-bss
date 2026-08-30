import styles from './BookingFields.module.css';

export default function RideFields({ value, onChange }) {
  const passengers = value.passengers || 1;

  return (
    <>
      <div className={styles.field}>
        <label className={styles.label}>Điểm đón</label>
        <input
          className={styles.input}
          placeholder="VD: 12 Trần Duy Hưng, Cầu Giấy"
          value={value.pickup}
          onChange={(e) => onChange({ pickup: e.target.value })}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Điểm đến</label>
        <input
          className={styles.input}
          placeholder="VD: 45 Bà Triệu, Hoàn Kiếm"
          value={value.dropoff}
          onChange={(e) => onChange({ dropoff: e.target.value })}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Số khách</label>
        <div className={styles.stepper}>
          <button
            type="button"
            className={styles.stepperBtn}
            onClick={() => onChange({ passengers: Math.max(1, passengers - 1) })}
          >−</button>
          <span className={styles.stepperValue}>{passengers}</span>
          <button
            type="button"
            className={styles.stepperBtn}
            onClick={() => onChange({ passengers: Math.min(2, passengers + 1) })}
          >+</button>
        </div>
        <span className={styles.hint}>Xe máy điện chở tối đa 2 khách.</span>
      </div>
    </>
  );
}
