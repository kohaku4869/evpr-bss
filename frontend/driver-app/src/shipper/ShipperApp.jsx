import { useCallback, useEffect, useRef, useState } from 'react';
import styles from '../App.module.css';
import { useCurrentRoute } from '../hooks/useCurrentRoute';
import { useStations } from '../hooks/useStations';
import { useDriveEngine } from '../hooks/useDriveEngine';
import { useRouteSocket } from '../hooks/useRouteSocket';
import { useShipperSettings } from '../hooks/useShipperSettings';
import { useBatteryCheckIn } from '../hooks/useBatteryCheckIn';
import { deriveVehicleStatus } from '../drivingEngine';
import { findNearestStation } from '../geo';
import StatusHeader from '../components/StatusHeader';
import MapView from '../components/MapView';
import NextStopCard from '../components/NextStopCard';
import AlertBanner from '../components/AlertBanner';
import StopListScreen from '../components/StopListScreen';
import StationStatusScreen from '../components/StationStatusScreen';
import AlertsScreen from '../components/AlertsScreen';
import ProfileScreen from '../components/ProfileScreen';
import HistoryScreen from '../components/HistoryScreen';
import SettingsScreen from '../components/SettingsScreen';
import BottomNav from '../components/BottomNav';
import LowBatteryWarningScreen from '../components/LowBatteryWarningScreen';
import NavigateToStationScreen from '../components/NavigateToStationScreen';
import BatteryCheckInModal from '../components/BatteryCheckInModal';

const MAX_ALERTS = 50;

// Mirrors backend/app/config.py's BASE_CONSUMPTION_RATE default (kWh per km
// at zero load) — no API exposes it today, so the client-side "range" hint
// approximates with the same constant rather than a real per-shipment figure.
const BASE_CONSUMPTION_RATE_KM = 2.2;

// No live speed telemetry either, so "time until empty" is range/assumed-speed
// rather than a real ETA — a typical Hanoi delivery-moped urban average.
const AVG_URBAN_SPEED_KMH = 25;

function formatMinutesToEmpty(minutes) {
  if (minutes == null) return null;
  if (minutes < 1) return '< 1 phút';
  if (minutes < 60) return `~${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem === 0 ? `~${hours}h` : `~${hours}h${rem}p`;
}

const TABS = [
  { key: 'map', icon: '🗺️', label: 'Bản đồ' },
  { key: 'stops', icon: '📍', label: 'Lộ trình' },
  { key: 'stations', icon: '🔋', label: 'Trạm pin' },
  { key: 'alerts', icon: '📜', label: 'Thông báo' },
  { key: 'profile', icon: '👤', label: 'Cá nhân' },
];

// Everything here talks to the real backend (routes/stations/WS) and is only
// ever mounted for role === 'shipper' — kept out of the customer flow entirely.
export default function ShipperApp({ onLogout }) {
  const [activeTab, setActiveTab] = useState('map');
  const [profileView, setProfileView] = useState('home'); // 'home' | 'history' | 'settings'
  const [alerts, setAlerts] = useState([]);
  const [banner, setBanner] = useState(null);
  const bannerTimerRef = useRef(null);
  const mapApiRef = useRef(null);

  const { route, refetch, applyRoute } = useCurrentRoute();
  const stationsApi = useStations();
  const { settings, updateSettings } = useShipperSettings();

  // null | 'warning' | 'navigate'. Reset whenever battery recovers above the
  // threshold so a later low-battery episode can prompt again.
  const [lowBatteryFlow, setLowBatteryFlow] = useState(null);
  const [lowBatterySnoozed, setLowBatterySnoozed] = useState(false);

  const onPositionChange = useCallback((pos) => {
    mapApiRef.current?.setVehiclePosition(pos);
  }, []);

  const driveEngine = useDriveEngine(route, onPositionChange);

  const addAlert = useCallback((msg, type = 'info') => {
    const entry = { id: `${Date.now()}-${Math.random()}`, time: new Date().toLocaleTimeString(), type, msg };
    setAlerts((prev) => [...prev, entry].slice(-MAX_ALERTS));
  }, []);

  const showBanner = useCallback((data) => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    setBanner(data);
    bannerTimerRef.current = setTimeout(() => setBanner(null), 6000);
  }, []);

  const closeBanner = useCallback(() => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    setBanner(null);
  }, []);

  useEffect(() => () => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
  }, []);

  // Recreated every render so it always closes over the latest route/driveEngine
  // state (useRouteSocket keeps a ref to the latest handler internally).
  async function handleWsEvent(data) {
    if (data.event === 'route_patched') {
      const previousTarget = driveEngine.targetStop;

      if (data.reason === 'new_order_added') {
        const label = data.new_stop?.label || 'Một đơn hàng mới';
        addAlert(`${label} vừa được thêm vào lộ trình của bạn.`, 'patch');
        showBanner({
          title: 'Có đơn hàng mới',
          desc: `${label} vừa được thêm vào lộ trình hiện tại — bạn sẽ ghé qua trong chặng tiếp theo.`,
        });
      } else {
        const oldName = data.old_stop?.label || 'Trạm đổi pin';
        const newName = data.new_stop?.label || 'trạm khác gần đó';
        addAlert(`${oldName} đang tạm ngưng hoạt động. Hệ thống đã tự động đổi sang ${newName}.`, 'patch');
        showBanner({
          title: 'Đã đổi trạm đổi pin',
          desc: `${oldName} hiện không sử dụng được. Lộ trình của bạn đã được cập nhật sang ${newName}.`,
        });
      }

      const newRoute = await refetch();
      if (newRoute) driveEngine.resyncAfterPatch(newRoute, previousTarget);
      stationsApi.refetch();
    } else if (data.event === 'route_patch_failed') {
      addAlert('Không tìm được trạm thay thế phù hợp cho lộ trình hiện tại. Vui lòng liên hệ tổng đài hỗ trợ.', 'error');
    } else if (data.event === 'station_status_changed') {
      const name = stationsApi.stations.find((s) => s.id === data.station_id)?.name || `Trạm #${data.station_id}`;
      addAlert(`${name} hiện ${data.is_available ? 'đã hoạt động trở lại' : 'tạm ngưng hoạt động'}.`, data.is_available ? 'info' : 'warn');
      stationsApi.refetch();
    }
  }

  const wsStatus = useRouteSocket(handleWsEvent);

  const handleCompleteStop = useCallback(async () => {
    try {
      const updated = await driveEngine.completeArrivedStop();
      if (updated) applyRoute(updated);
    } catch (err) {
      addAlert(`Không thể hoàn thành điểm dừng này: ${err}`, 'error');
    }
  }, [driveEngine, applyRoute, addAlert]);

  const handleLogout = useCallback(() => {
    setActiveTab('map');
    setProfileView('home');
    onLogout();
  }, [onLogout]);

  const { batteryPercent, batteryKwh, load } = deriveVehicleStatus(route, driveEngine.targetStop);

  const referenceStop = driveEngine.targetStop;
  const nearestStationInfo = referenceStop
    ? findNearestStation(stationsApi.stations, referenceStop.lat, referenceStop.lng)
    : null;
  const rangeKm = route ? Math.round(batteryKwh / BASE_CONSUMPTION_RATE_KM) : null;
  const minutesToEmpty = rangeKm != null ? Math.round((rangeKm / AVG_URBAN_SPEED_KMH) * 60) : null;
  const timeToEmptyLabel = formatMinutesToEmpty(minutesToEmpty);

  const isLowBattery = !!route && batteryPercent != null && batteryPercent <= settings.warningThresholdPercent;

  useEffect(() => {
    if (!isLowBattery) {
      setLowBatteryFlow(null);
      setLowBatterySnoozed(false);
      return;
    }
    if (!lowBatterySnoozed && lowBatteryFlow === null) {
      setLowBatteryFlow('warning');
    }
  }, [isLowBattery, lowBatterySnoozed, lowBatteryFlow]);

  const handleApproveLowBattery = useCallback(() => {
    setLowBatteryFlow('navigate');
  }, []);

  const handleDismissLowBattery = useCallback(() => {
    setLowBatterySnoozed(true);
    setLowBatteryFlow(null);
  }, []);

  const checkIn = useBatteryCheckIn(!!route);

  const targetStopSwapFee = driveEngine.targetStop?.stop_type === 'swap_station'
    ? stationsApi.stations.find((s) => s.id === driveEngine.targetStop.ref_station_id)?.cost_swap
    : null;

  return (
    <div className={styles.app}>
      <StatusHeader
        wsStatus={wsStatus}
        batteryPercent={route ? batteryPercent : null}
        batteryKwh={route ? batteryKwh : null}
        load={route ? load : null}
        rangeKm={route ? rangeKm : null}
        timeToEmptyLabel={route ? timeToEmptyLabel : null}
        nearestStationKm={nearestStationInfo ? Math.round(nearestStationInfo.distanceKm * 10) / 10 : null}
      />

      <div className={styles.screen}>
        {lowBatteryFlow === 'navigate' && nearestStationInfo ? (
          <NavigateToStationScreen
            route={route}
            stations={stationsApi.stations}
            station={nearestStationInfo.station}
            distanceKm={nearestStationInfo.distanceKm}
            onClose={handleDismissLowBattery}
          />
        ) : (
          <>
            {activeTab === 'map' && (
              <>
                <MapView ref={mapApiRef} route={route} stations={stationsApi.stations} targetStop={driveEngine.targetStop} />
                <AlertBanner banner={banner} onClose={closeBanner} />
                <NextStopCard
                  phase={driveEngine.phase}
                  targetStop={driveEngine.targetStop}
                  batteryPercent={route ? batteryPercent : null}
                  swapFeeUsd={targetStopSwapFee}
                  remainingStopsCount={route?.stops?.filter((s) => s.status === 'pending').length ?? 0}
                  onOpenStopList={() => setActiveTab('stops')}
                  onComplete={handleCompleteStop}
                />
              </>
            )}
            {activeTab === 'stops' && <StopListScreen route={route} />}
            {activeTab === 'stations' && (
              <StationStatusScreen
                stations={stationsApi.stations}
                referenceLat={referenceStop?.lat}
                referenceLng={referenceStop?.lng}
              />
            )}
            {activeTab === 'alerts' && <AlertsScreen alerts={alerts} />}
            {activeTab === 'profile' && profileView === 'home' && (
              <ProfileScreen
                onOpenHistory={() => setProfileView('history')}
                onOpenSettings={() => setProfileView('settings')}
                onLogout={handleLogout}
              />
            )}
            {activeTab === 'profile' && profileView === 'history' && (
              <HistoryScreen onBack={() => setProfileView('home')} />
            )}
            {activeTab === 'profile' && profileView === 'settings' && (
              <SettingsScreen onBack={() => setProfileView('home')} settings={settings} onUpdateSettings={updateSettings} />
            )}

            {lowBatteryFlow === 'warning' && (
              <LowBatteryWarningScreen
                batteryPercent={batteryPercent}
                thresholdPercent={settings.warningThresholdPercent}
                stationName={nearestStationInfo?.station?.name}
                timeToEmptyLabel={timeToEmptyLabel}
                onApprove={handleApproveLowBattery}
                onReject={handleDismissLowBattery}
              />
            )}
          </>
        )}

        {checkIn.duePrompt && !lowBatteryFlow && (
          <BatteryCheckInModal
            checkpoint={checkIn.duePrompt}
            predictedPercent={route ? batteryPercent : null}
            vehicleType={settings.vehicleType}
            batteryCapacityKwh={settings.batteryCapacityKwh}
            onSubmit={(reading) => checkIn.dismiss(reading)}
            onSkip={() => checkIn.dismiss(null)}
          />
        )}
      </div>

      <BottomNav tabs={TABS} active={activeTab} onChange={setActiveTab} />
    </div>
  );
}
