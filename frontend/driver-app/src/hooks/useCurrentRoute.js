import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchCurrentRoute } from '../api';

// POST /plan/optimize, /demo/randomize and /demo/reset emit no WS event, so an
// already-open Driver Mode tab would never learn a fresh route was planned on
// the admin dashboard without this background poll.
const POLL_INTERVAL_MS = 12000;

export function useCurrentRoute() {
  const [route, setRoute] = useState(null);
  const routeRef = useRef(null);

  const refetch = useCallback(async () => {
    try {
      const next = await fetchCurrentRoute();
      routeRef.current = next;
      setRoute(next);
      return next;
    } catch (err) {
      console.error('Error fetching current route:', err);
      return routeRef.current;
    }
  }, []);

  useEffect(() => {
    refetch();
    const interval = setInterval(refetch, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refetch]);

  const applyRoute = useCallback((next) => {
    routeRef.current = next;
    setRoute(next);
  }, []);

  return { route, refetch, applyRoute };
}
