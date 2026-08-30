import { FOOD_RESTAURANTS } from '../mockCustomerData';
import styles from './BookingFields.module.css';

export default function FoodFields({ value, onChange }) {
  return (
    <>
      <div className={styles.field}>
        <label className={styles.label}>Chọn quán ăn</label>
        <select
          className={styles.input}
          value={value.restaurantId || ''}
          onChange={(e) => onChange({ restaurantId: e.target.value })}
        >
          <option value="" disabled>-- Chọn quán --</option>
          {FOOD_RESTAURANTS.map((r) => (
            <option key={r.id} value={r.id}>{r.name} ({r.category})</option>
          ))}
        </select>
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Địa chỉ giao hàng</label>
        <input
          className={styles.input}
          placeholder="VD: 45 Bà Triệu, Hoàn Kiếm"
          value={value.dropoff}
          onChange={(e) => onChange({ dropoff: e.target.value })}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Ghi chú món ăn (không bắt buộc)</label>
        <textarea
          className={styles.input}
          placeholder="VD: Không hành, ít cay…"
          value={value.note}
          onChange={(e) => onChange({ note: e.target.value })}
        />
      </div>
    </>
  );
}
