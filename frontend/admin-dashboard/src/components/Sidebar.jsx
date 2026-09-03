import styles from './Sidebar.module.css';

const SECTIONS = [
  { key: 'overview', icon: '🗺️', label: 'Tổng quan' },
  { key: 'dispatch', icon: '🚨', label: 'Cảnh báo & Điều phối' },
  { key: 'stations', icon: '🔋', label: 'Trạm đổi pin' },
  { key: 'analytics', icon: '📊', label: 'Phân tích Năng lượng' },
  { key: 'drivers', icon: '🧾', label: 'Tài xế & Đối soát' },
];

export default function Sidebar({ active, onChange, pendingCount, incidentCount, overloadedCount }) {
  const badgeFor = (key) => {
    if (key === 'dispatch') return pendingCount + incidentCount;
    if (key === 'stations') return overloadedCount;
    return 0;
  };

  return (
    <nav className={styles.nav}>
      {SECTIONS.map((s) => {
        const badge = badgeFor(s.key);
        return (
          <button
            key={s.key}
            className={`${styles.item} ${active === s.key ? styles.active : ''}`}
            onClick={() => onChange(s.key)}
          >
            <span className={styles.icon}>{s.icon}</span>
            <span className={styles.label}>{s.label}</span>
            {badge > 0 && <span className={styles.badge}>{badge}</span>}
          </button>
        );
      })}
    </nav>
  );
}
