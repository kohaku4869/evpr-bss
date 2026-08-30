export const SHIPPER_ID = 1;

// Dev: talk directly to the FastAPI backend on :8000 (CORS is open, WS has no
// Origin check, so no Vite proxy is needed). Prod: this bundle is served by
// FastAPI itself at /driver, so same-origin relative URLs just work.
export const API_BASE = import.meta.env.DEV
  ? (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000')
  : '';

export const WS_BASE = import.meta.env.DEV
  ? (import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000')
  : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
