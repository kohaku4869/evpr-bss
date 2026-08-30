import styles from './AlertBanner.module.css';

export default function AlertBanner({ banner, onClose }) {
  if (!banner) return null;

  return (
    <div className={styles.banner}>
      <span className={styles.icon}>⚡</span>
      <div className={styles.content}>
        <div className={styles.title}>{banner.title}</div>
        <div className={styles.desc}>{banner.desc}</div>
      </div>
      <button className={styles.close} onClick={onClose}>✕</button>
    </div>
  );
}
