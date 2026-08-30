import styles from './SplashScreen.module.css';

export default function SplashScreen() {
  return (
    <div className={styles.splash}>
      <div className={styles.logo}>⚡</div>
      <div>
        <div className={styles.title}>EVPR-BSS Tài Xế</div>
        <div className={styles.subtitle}>Ứng dụng dành cho tài xế giao hàng xe điện</div>
      </div>
      <div className={styles.loading}>Đang khởi động…</div>
    </div>
  );
}
