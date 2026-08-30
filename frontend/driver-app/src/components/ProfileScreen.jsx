import { MOCK_DRIVER } from '../mockData';
import styles from './ProfileScreen.module.css';

export default function ProfileScreen({ onOpenHistory, onOpenSettings, onLogout }) {
  const d = MOCK_DRIVER;

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.avatar}>{d.avatarInitials}</div>
        <div>
          <div className={styles.name}>{d.name}</div>
          <div className={styles.meta}>Mã tài xế: {d.driverCode} · Biển số: {d.vehiclePlate}</div>
          <div className={styles.meta}>Tham gia từ {d.memberSince}</div>
        </div>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statBox}>
          <div className={styles.statValue}>⭐ {d.rating}</div>
          <div className={styles.statLabel}>Đánh giá</div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statValue}>{d.totalTrips}</div>
          <div className={styles.statLabel}>Tổng chuyến</div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statValue}>{d.totalDistanceKm}km</div>
          <div className={styles.statLabel}>Quãng đường</div>
        </div>
      </div>

      <div className={styles.menu}>
        <button className={styles.menuItem} onClick={onOpenHistory}>
          <span className={styles.menuItemLeft}>📖 Lịch sử chuyến</span>
          <span className={styles.chevron}>›</span>
        </button>
        <button className={styles.menuItem} onClick={onOpenSettings}>
          <span className={styles.menuItemLeft}>⚙️ Cài đặt</span>
          <span className={styles.chevron}>›</span>
        </button>
        <button className={styles.menuItem} onClick={() => {}}>
          <span className={styles.menuItemLeft}>💬 Trợ giúp & Hỗ trợ</span>
          <span className={styles.chevron}>›</span>
        </button>
      </div>

      <button className={styles.logoutBtn} onClick={onLogout}>Đăng xuất</button>
    </div>
  );
}
