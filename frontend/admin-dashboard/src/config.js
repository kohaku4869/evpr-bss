// Same dev/prod split as driver-app/src/config.js: talk directly to FastAPI on
// :8000 in dev, same-origin relative URLs once this bundle is served by
// FastAPI itself at /admin.
export const API_BASE = import.meta.env.DEV
  ? (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000')
  : '';
