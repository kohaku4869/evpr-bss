import styles from './BottomNav.module.css';

// Generic tab bar reused by both the shipper app and the customer app, each
// passing its own tab list — keeps the two role flows from sharing state.
export default function BottomNav({ tabs, active, onChange }) {
  return (
    <nav className={styles.nav}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={`${styles.tab} ${active === tab.key ? styles.active : ''}`}
          onClick={() => onChange(tab.key)}
        >
          <span className={styles.icon}>{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
