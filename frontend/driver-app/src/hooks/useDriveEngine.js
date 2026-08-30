import { useCallback, useEffect, useRef, useState } from 'react';
import { completeStop } from '../api';
import { getTargetStop, positionFromRoute, stepOnce, syncAfterPatch } from '../drivingEngine';

// Fixed, non-exposed speed: a real driver's phone wouldn't show a sim-speed
// picker (that's a demo-operator convenience, kept only on the admin dashboard).
const TICK_MS = 60;

// Stateful binding layer around drivingEngine.js. Keeps the per-tick vehicle
// position out of React state (delivered instead via onPositionChange, called
// imperatively) so animation ticks don't force a re-render; only phase/target
// changes (once per stop, not once per tick) go through useState.
export function useDriveEngine(route, onPositionChange) {
  const [phase, setPhase] = useState('idle'); // 'idle' | 'driving' | 'arrived' | 'finished'
  const [targetStop, setTargetStop] = useState(null);

  const routeRef = useRef(route);
  const engineStateRef = useRef(null);
  const timerRef = useRef(null);
  const onPositionChangeRef = useRef(onPositionChange);

  routeRef.current = route;
  onPositionChangeRef.current = onPositionChange;

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const tick = useCallback(() => {
    const currentRoute = routeRef.current;
    const state = engineStateRef.current;
    if (!currentRoute || !state) return;

    const result = stepOnce(currentRoute, state);
    engineStateRef.current = result.state;

    if (!result.arrived) {
      onPositionChangeRef.current?.(result.state.vehiclePos);
      timerRef.current = setTimeout(tick, TICK_MS);
      return;
    }

    if (result.targetStop) {
      setPhase('arrived');
      setTargetStop(result.targetStop);
    } else {
      setPhase('finished');
      setTargetStop(null);
    }
  }, []);

  // Reposition the vehicle whenever a *different* route becomes active (a
  // fresh Optimize/Randomize). Mid-route patches are handled by resyncAfterPatch
  // below instead of here, since the route id stays the same for those.
  useEffect(() => {
    clearTimer();

    if (!route || !route.stops || route.stops.length === 0) {
      engineStateRef.current = null;
      setPhase('idle');
      setTargetStop(null);
      return undefined;
    }

    const state = positionFromRoute(route);
    engineStateRef.current = state;
    onPositionChangeRef.current?.(state.vehiclePos);

    const target = getTargetStop(route, state);
    if (target) {
      setPhase('driving');
      setTargetStop(target);
      timerRef.current = setTimeout(tick, TICK_MS);
    } else {
      setPhase('finished');
      setTargetStop(null);
    }

    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.id, tick]);

  const completeArrivedStop = useCallback(async () => {
    const currentRoute = routeRef.current;
    const state = engineStateRef.current;
    if (!currentRoute || !state) return null;

    const arrivedStop = getTargetStop(currentRoute, state);
    if (!arrivedStop) return null;

    const updatedRoute = await completeStop(currentRoute.id, arrivedStop.id);
    routeRef.current = updatedRoute;

    const newState = positionFromRoute(updatedRoute);
    engineStateRef.current = newState;
    onPositionChangeRef.current?.(newState?.vehiclePos);

    const newTarget = newState ? getTargetStop(updatedRoute, newState) : null;
    if (newTarget) {
      setPhase('driving');
      setTargetStop(newTarget);
      timerRef.current = setTimeout(tick, TICK_MS);
    } else {
      setPhase('finished');
      setTargetStop(null);
    }

    return updatedRoute;
  }, [tick]);

  // Called from the WS route_patched handler (before the parent applies the
  // patched route to its own state) so the vehicle hops to the new suffix
  // instead of teleporting backward. Ignored unless actively driving.
  const resyncAfterPatch = useCallback((patchedRoute, previousTargetStop) => {
    if (phase !== 'driving') return;
    const state = engineStateRef.current;
    if (!state) return;

    const newState = syncAfterPatch(patchedRoute, state, previousTargetStop);
    engineStateRef.current = newState;
    routeRef.current = patchedRoute;
    onPositionChangeRef.current?.(newState.vehiclePos);
    setTargetStop(getTargetStop(patchedRoute, newState));
  }, [phase]);

  return { phase, targetStop, completeArrivedStop, resyncAfterPatch };
}
