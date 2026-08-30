import styles from './SubScreenHeader.module.css';

export default function SubScreenHeader({ title, onBack }) {
  return (
    <div className={styles.header}>
      <button className={styles.backBtn} onClick={onBack} aria-label="Quay lại">←</button>
      <span className={styles.title}>{title}</span>
    </div>
  );
}
