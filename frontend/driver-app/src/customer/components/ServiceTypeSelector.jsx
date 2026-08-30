import { SERVICE_TYPES } from '../mockCustomerData';
import styles from './ServiceTypeSelector.module.css';

export default function ServiceTypeSelector({ value, onChange }) {
  return (
    <div className={styles.grid}>
      {SERVICE_TYPES.map((s) => (
        <button
          key={s.key}
          type="button"
          className={`${styles.card} ${value === s.key ? styles.active : ''}`}
          onClick={() => onChange(s.key)}
        >
          <span className={styles.icon}>{s.icon}</span>
          <span className={styles.label}>{s.label}</span>
        </button>
      ))}
    </div>
  );
}
