import styles from './LowBatteryWarningScreen.module.css';

export default function LowBatteryWarningScreen({ batteryPercent, thresholdPercent, stationName, timeToEmptyLabel, onApprove, onReject }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.sheet}>
        <div className={styles.icon}>🔋⚠️</div>
        <div className={styles.title}>Pin xe sắp xuống thấp</div>
        <div className={styles.desc}>
          Pin hiện tại còn <b>{batteryPercent}%</b>, dưới ngưỡng cảnh báo bạn đã đặt ({thresholdPercent}%).
          {timeToEmptyLabel && <> Dự kiến hết pin sau <b>{timeToEmptyLabel}</b> nếu tiếp tục di chuyển.</>}
          {' '}Bạn có muốn hệ thống dẫn đường tới trạm đổi pin gần nhất{stationName ? ` (${stationName})` : ''} không?
        </div>
        <div className={styles.actions}>
          <button className={styles.rejectBtn} onClick={onReject}>Để sau</button>
          <button className={styles.approveBtn} onClick={onApprove}>Đồng ý, dẫn đường</button>
        </div>
      </div>
    </div>
  );
}
