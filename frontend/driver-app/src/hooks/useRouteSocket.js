import { useEffect, useRef, useState } from 'react';
import { WS_BASE, SHIPPER_ID } from '../config';

// Ported from app.js's initWebSocket/handleWebSocketEvent: same reconnect-after-3s
// behavior, but forwards parsed messages to a caller-supplied handler instead of
// hard-coding DOM updates.
export function useRouteSocket(onEvent) {
  const [status, setStatus] = useState('connecting');
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let ws = null;
    let reconnectTimer = null;
    let closedByCleanup = false;

    function connect() {
      setStatus((prev) => (prev === 'connected' ? prev : 'connecting'));
      ws = new WebSocket(`${WS_BASE}/ws/route/${SHIPPER_ID}`);

      ws.onopen = () => setStatus('connected');

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onEventRef.current?.(data);
        } catch (err) {
          console.error('Error parsing WS message:', err);
        }
      };

      ws.onclose = () => {
        if (closedByCleanup) return;
        setStatus('reconnecting');
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      closedByCleanup = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

  return status;
}
