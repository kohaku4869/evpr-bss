import { MOCK_CUSTOMER } from '../mockCustomerData';
import styles from './CustomerProfileScreen.module.css';

export default function CustomerProfileScreen({ onLogout }) {
  const c = MOCK_CUSTOMER;

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.avatar}>{c.avatarInitials}</div>
        <div>
          <div className={styles.name}>{c.name}</div>
          <div className={styles.meta}>{c.phone} · {c.email}</div>
          <div className={styles.meta}>Thành viên từ {c.memberSince}</div>
        </div>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statBox}>
          <div className={styles.statValue}>{c.totalOrders}</div>
          <div className={styles.statLabel}>Tổng đơn</div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statValue}>{c.points}</div>
          <div className={styles.statLabel}>Điểm tích lũy</div>
        </div>
      </div>

      <div className={styles.menu}>
        <button className={styles.menuItem} onClick={() => {}}>
          <span className={styles.menuItemLeft}>📍 Địa chỉ đã lưu</span>
          <span className={styles.chevron}>›</span>
        </button>
        <button className={styles.menuItem} onClick={() => {}}>
          <span className={styles.menuItemLeft}>💳 Phương thức thanh toán</span>
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
