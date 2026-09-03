import { useState } from 'react';
import SuggestionGroupCard from './SuggestionGroupCard';
import ManualEditModal from './ManualEditModal';
import styles from './SuggestionsPanel.module.css';

const OUTCOME_ICON = { approved: '✅', rejected: '✕', manual: '✏️' };

function timeLabel(date) {
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function SuggestionsPanel({
  pending, decisionLog, stations, shippers,
  onApproveGroup, onRejectGroup, onManualEditGroup, onApproveOne, onRejectOne, onManualDispatch,
}) {
  const [editingGroup, setEditingGroup] = useState(null);
  const [adHocOpen, setAdHocOpen] = useState(false);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>🤖 Gợi ý điều phối AI ({pending.length})</h2>
        <button className={styles.adHocBtn} onClick={() => setAdHocOpen(true)}>+ Điều phối thủ công</button>
      </div>

      <div className={styles.feed}>
        {pending.length === 0 && (
          <div className={styles.empty}>Không có gợi ý nào đang chờ — hệ thống đang theo dõi.</div>
        )}
        {pending.map((group) => (
          <SuggestionGroupCard
            key={group.id}
            group={group}
            onApproveGroup={onApproveGroup}
            onRejectGroup={onRejectGroup}
            onManualEdit={setEditingGroup}
            onApproveOne={onApproveOne}
            onRejectOne={onRejectOne}
          />
        ))}
      </div>

      {decisionLog.length > 0 && (
        <div className={styles.logSection}>
          <div className={styles.logTitle}>Lịch sử quyết định</div>
          <div className={styles.logList}>
            {decisionLog.map((entry) => (
              <div key={`${entry.id}-${entry.decidedAt.getTime()}`} className={styles.logRow}>
                <span className={styles.logIcon}>{OUTCOME_ICON[entry.outcome]}</span>
                <span className={styles.logText}>{entry.note || entry.title}</span>
                <span className={styles.logTime}>{timeLabel(entry.decidedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {editingGroup && (
        <ManualEditModal
          suggestion={editingGroup}
          stations={stations}
          onCancel={() => setEditingGroup(null)}
          onConfirm={(summary) => {
            onManualEditGroup(editingGroup.id, summary);
            setEditingGroup(null);
          }}
        />
      )}

      {adHocOpen && (
        <ManualEditModal
          suggestion={null}
          stations={stations}
          shippers={shippers}
          onCancel={() => setAdHocOpen(false)}
          onConfirm={(summary) => {
            onManualDispatch(summary);
            setAdHocOpen(false);
          }}
        />
      )}
    </div>
  );
}
