import { useState } from 'react';
import { STOP_TYPE_LABEL } from '../i18n';
import { mockAddressFor, mockContactNoteFor, mockFeeFor, mockPaymentMethodFor, formatVnd, googleMapsDirectionsUrl } from '../mockStopDetails';
import styles from './NextStopCard.module.css';

const ACTION_ITEMS = [
  { icon: '🔄', label: 'Đổi lộ trình' },
  { icon: '💬', label: 'Chat' },
  { icon: '📞', label: 'Gọi' },
  { icon: '⋯', label: 'Xem thêm' },
];

function NavigateButton({ lat, lng }) {
  if (lat == null || lng == null) return null;
  return (
    <a
      className={styles.navBtn}
      href={googleMapsDirectionsUrl(lat, lng)}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
    >
      <span className={styles.navIcon}>🧭</span>
      <span>Định hướng</span>
    </a>
  );
}

function StopCountBadge({ count, onClick }) {
  return (
    <button className={styles.stopCountBadge} onClick={onClick}>
      <span className={styles.stopCountNum}>{count}</span>
      <span className={styles.stopCountLabel}>Địa điểm</span>
    </button>
  );
}

export default function NextStopCard({ phase, targetStop, batteryPercent, swapFeeUsd, remainingStopsCount, onOpenStopList, onComplete }) {
  const [completing, setCompleting] = useState(false);

  if (phase === 'idle') {
    return (
      <div className={styles.card}>
        <div className={styles.emptyCard}>Chưa có lộ trình nào đang hoạt động.</div>
      </div>
    );
  }

  if (phase === 'finished' || !targetStop) {
    return (
      <div className={styles.card}>
        <div className={styles.emptyCard}>🏁 Đã hoàn thành chuyến đi! Tất cả đơn hàng đã được giao.</div>
      </div>
    );
  }

  const isArrived = phase === 'arrived';

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await onComplete();
    } finally {
      setCompleting(false);
    }
  };

  if (targetStop.stop_type === 'swap_station') {
    const isLow = batteryPercent != null && batteryPercent <= 20;
    return (
      <div className={`${styles.card} ${styles.swapCard} ${isArrived ? styles.arrived : ''}`}>
        <div className={styles.topRow}>
          <StopCountBadge count={remainingStopsCount} onClick={onOpenStopList} />
          <div className={styles.swapInfo}>
            <div className={styles.swapTitle}>{isArrived ? 'Đã đến trạm đổi pin' : 'Trạm đổi pin tiếp theo'}</div>
            <div className={styles.label}>#{targetStop.sequence_index} {targetStop.label || 'Trạm đổi pin'}</div>
          </div>
          <NavigateButton lat={targetStop.lat} lng={targetStop.lng} />
        </div>

        <div className={styles.swapMeta}>
          <span className={`${styles.batteryPill} ${isLow ? styles.batteryPillLow : ''}`}>
            Pin hiện tại: {batteryPercent != null ? `${batteryPercent}%` : '--'}
          </span>
          {swapFeeUsd != null && (
            <span className={styles.feePill}>Phí đổi pin: ${swapFeeUsd.toFixed(1)}</span>
          )}
        </div>
        <div className={styles.swapHint}>Đổi pin tại đây sẽ nạp đầy pin của bạn.</div>

        <button className={styles.completeBtn} disabled={!isArrived || completing} onClick={handleComplete}>
          {completing ? '...' : isArrived ? 'Đã đến' : 'Đang di chuyển…'}
        </button>
      </div>
    );
  }

  const fee = mockFeeFor(targetStop);
  const contactNote = mockContactNoteFor(targetStop);

  return (
    <div className={`${styles.card} ${isArrived ? styles.arrived : ''}`}>
      <div className={styles.topRow}>
        <StopCountBadge count={remainingStopsCount} onClick={onOpenStopList} />

        <div className={styles.orderInfo}>
          <span className={`${styles.tag} ${styles[targetStop.stop_type] || ''}`}>
            #{targetStop.sequence_index} · {STOP_TYPE_LABEL[targetStop.stop_type] || targetStop.stop_type}
          </span>
          <div className={styles.orderSub}>{targetStop.label || STOP_TYPE_LABEL[targetStop.stop_type]}</div>
        </div>

        <NavigateButton lat={targetStop.lat} lng={targetStop.lng} />
      </div>

      <div className={styles.addressBlock}>{mockAddressFor(targetStop)}</div>
      {contactNote && <div className={styles.noteLine}>{contactNote}</div>}

      <div className={styles.feeRow}>
        <span className={styles.feeAmount}>{formatVnd(fee.base)} + {formatVnd(fee.tip)}</span>
        <span className={styles.paymentPill}>{mockPaymentMethodFor(targetStop)}</span>
      </div>

      <div className={styles.actionsRow}>
        {ACTION_ITEMS.map((a) => (
          <div key={a.label} className={styles.actionItem}>
            <span className={styles.actionIcon}>{a.icon}</span>
            <span className={styles.actionLabel}>{a.label}</span>
          </div>
        ))}
      </div>

      <button className={styles.completeBtn} disabled={!isArrived || completing} onClick={handleComplete}>
        {completing ? '...' : isArrived ? 'Đã đến' : 'Đang di chuyển…'}
      </button>
    </div>
  );
}
