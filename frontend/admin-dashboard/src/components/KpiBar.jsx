import styles from './KpiBar.module.css';

function Metric({ label, value, warn }) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={`${styles.metricValue} ${warn ? styles.warn : ''}`}>{value}</span>
    </div>
  );
}

export default function KpiBar({ fleet, orders, lowBatteryCount, finance }) {
  return (
    <div className={styles.row}>
      <div className={styles.card}>
        <div className={styles.cardTitle}>🛵 Đội xe</div>
        <div className={styles.metricsGrid}>
          <Metric label="Hoạt động" value={fleet.driving} />
          <Metric label="Rảnh" value={fleet.idle} />
          <Metric label="Đang sạc/đổi pin" value={fleet.charging} />
          <Metric label="Bảo trì" value={fleet.maintenance} warn={fleet.maintenance > 0} />
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>📦 Đơn hàng & SLA</div>
        <div className={styles.metricsGrid}>
          <Metric label="Tổng đơn trong ca" value={orders.totalOrdersToday} />
          <Metric label="Đúng giờ" value={`${orders.onTimeRate}%`} warn={orders.onTimeRate < 98} />
          <Metric label="Có nguy cơ trễ" value={orders.atRiskOrders} warn={orders.atRiskOrders > 5} />
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>⚠️ An toàn năng lượng</div>
        <div className={styles.singleMetric}>
          <span className={`${styles.bigValue} ${lowBatteryCount > 0 ? styles.warn : ''}`}>{lowBatteryCount}</span>
          <span className={styles.metricLabel}>xe pin dưới 20%</span>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>💰 Hiệu quả tài chính</div>
        <div className={styles.metricsGrid}>
          <Metric label="Chi phí NL / đơn" value={`${finance.costPerOrder.toLocaleString('vi-VN')}đ`} />
          <Metric label="CO₂ cắt giảm hôm nay" value={`${finance.co2SavedKg} kg`} />
        </div>
      </div>
    </div>
  );
}
