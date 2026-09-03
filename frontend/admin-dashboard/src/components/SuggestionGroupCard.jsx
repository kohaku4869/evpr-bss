import { useState } from 'react';
import styles from './SuggestionGroupCard.module.css';

const SEVERITY_LABEL = { warning: 'Cảnh báo', critical: 'Nghiêm trọng' };

function timeLabel(date) {
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function SuggestionGroupCard({ group, onApproveGroup, onRejectGroup, onManualEdit, onApproveOne, onRejectOne }) {
  const [expanded, setExpanded] = useState(false);
  const count = group.affectedShippers.length;

  return (
    <div className={`${styles.card} ${styles[group.severity] || ''}`}>
      <div className={styles.headerRow}>
        <span className={`${styles.severityTag} ${styles[group.severity] || ''}`}>
          {SEVERITY_LABEL[group.severity] || group.severity}
        </span>
        <span className={styles.time}>{timeLabel(group.createdAt)}</span>
      </div>

      <div className={styles.title}>{group.title}</div>
      <div className={styles.message}>{group.message}</div>

      <button className={styles.expandBtn} onClick={() => setExpanded((v) => !v)}>
        {expanded ? '▾' : '▸'} {count} tài xế bị ảnh hưởng
      </button>

      {expanded && (
        <div className={styles.driverList}>
          {group.affectedShippers.map((s) => (
            <div key={s.id} className={styles.driverRow}>
              <span className={styles.driverName}>{s.name}</span>
              <div className={styles.driverActions}>
                <button className={styles.miniReject} onClick={() => onRejectOne(group.id, s.id)}>Từ chối</button>
                <button className={styles.miniApprove} onClick={() => onApproveOne(group.id, s.id)}>Duyệt</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.actions}>
        <button className={styles.rejectBtn} onClick={() => onRejectGroup(group.id)}>Từ chối tất cả</button>
        <button className={styles.editBtn} onClick={() => onManualEdit(group)}>Chỉnh thủ công</button>
        <button className={styles.approveBtn} onClick={() => onApproveGroup(group.id)}>Duyệt tất cả ({count})</button>
      </div>
    </div>
  );
}
