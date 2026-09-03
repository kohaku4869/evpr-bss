import { useCallback, useEffect, useState } from 'react';

// Fixed daily checkpoints (24h "HH:MM") shippers get asked their real battery
// level — feeds the future "1.2 Phân hệ Dự đoán Mức độ Hao hụt Pin Thực tế"
// ML module. Frontend-only for now: answers are stored locally, not POSTed
// anywhere yet (see plan doc) — the payload shape is chosen to be a trivial
// lift to a future backend call.
export const CHECK_IN_CHECKPOINTS = ['09:00', '12:00', '15:00', '18:00'];

const POLL_MS = 30_000;
const LOG_STORAGE_KEY = 'battery_checkins_v1';
const ANSWERED_STORAGE_KEY = 'battery_checkin_answered_v1';

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function loadAnswered() {
  try {
    const raw = localStorage.getItem(ANSWERED_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed.date === todayKey() ? parsed.checkpoints : [];
  } catch (err) {
    console.error('Error loading battery check-in state:', err);
    return [];
  }
}

function saveAnswered(checkpoints) {
  try {
    localStorage.setItem(ANSWERED_STORAGE_KEY, JSON.stringify({ date: todayKey(), checkpoints }));
  } catch (err) {
    console.error('Error saving battery check-in state:', err);
  }
}

function currentHHMM() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function findDueCheckpoint(answeredToday) {
  const nowHHMM = currentHHMM();
  return CHECK_IN_CHECKPOINTS.find((cp) => cp <= nowHHMM && !answeredToday.includes(cp)) || null;
}

// `active` gates prompting to only while a route is actually running, per
// "khi shipper đang chạy tuyến".
export function useBatteryCheckIn(active) {
  const [duePrompt, setDuePrompt] = useState(null);

  useEffect(() => {
    if (!active) {
      setDuePrompt(null);
      return undefined;
    }

    const check = () => setDuePrompt(findDueCheckpoint(loadAnswered()));
    check();
    const interval = setInterval(check, POLL_MS);
    return () => clearInterval(interval);
  }, [active]);

  const dismiss = useCallback((entry) => {
    const checkpoint = duePrompt;
    if (!checkpoint) return;

    if (entry) {
      try {
        const raw = localStorage.getItem(LOG_STORAGE_KEY);
        const log = raw ? JSON.parse(raw) : [];
        log.push({ ts: new Date().toISOString(), checkpoint, ...entry });
        localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(log));
      } catch (err) {
        console.error('Error saving battery check-in entry:', err);
      }
    }

    saveAnswered([...loadAnswered(), checkpoint]);
    setDuePrompt(null);
  }, [duePrompt]);

  return { duePrompt, dismiss };
}
