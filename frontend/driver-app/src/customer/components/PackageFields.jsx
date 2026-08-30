import styles from './BookingFields.module.css';

export default function PackageFields({ value, onChange }) {
  return (
    <>
      <div className={styles.field}>
        <label className={styles.label}>Điểm lấy hàng</label>
        <input
          className={styles.input}
          placeholder="VD: 12 Trần Duy Hưng, Cầu Giấy"
          value={value.pickup}
          onChange={(e) => onChange({ pickup: e.target.value })}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Điểm giao hàng</label>
        <input
          className={styles.input}
          placeholder="VD: 45 Bà Triệu, Hoàn Kiếm"
          value={value.dropoff}
          onChange={(e) => onChange({ dropoff: e.target.value })}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Mô tả hàng hóa (không bắt buộc)</label>
        <input
          className={styles.input}
          placeholder="VD: Tài liệu, quà tặng…"
          value={value.itemDesc}
          onChange={(e) => onChange({ itemDesc: e.target.value })}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Khối lượng (kg)</label>
        <input
          className={styles.input}
          type="number"
          min="0.1"
          step="0.1"
          placeholder="VD: 2.5"
          value={value.weight}
          onChange={(e) => onChange({ weight: e.target.value })}
        />
        <span className={styles.hint}>Khối lượng giúp hệ thống tính toán lộ trình và chọn xe phù hợp.</span>
      </div>
    </>
  );
}
