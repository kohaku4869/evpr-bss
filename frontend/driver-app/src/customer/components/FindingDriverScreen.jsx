import styles from './FindingDriverScreen.module.css';

export default function FindingDriverScreen() {
  return (
    <div className={styles.wrap}>
      <div className={styles.spinner} />
      <div className={styles.title}>Đang tìm tài xế phù hợp…</div>
      <div className={styles.subtitle}>Vui lòng chờ trong giây lát</div>
    </div>
  );
}
