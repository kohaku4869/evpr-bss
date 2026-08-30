import { useCallback, useEffect, useRef, useState } from 'react';
import styles from '../App.module.css';
import { useCurrentRoute } from '../hooks/useCurrentRoute';
import { useStations } from '../hooks/useStations';
import { useDriveEngine } from '../hooks/useDriveEngine';
import { useRouteSocket } from '../hooks/useRouteSocket';
import { deriveVehicleStatus } from '../drivingEngine';
import StatusHeader from '../components/StatusHeader';
import MapView from '../components/MapView';
import NextStopCard from '../components/NextStopCard';
import AlertBanner from '../components/AlertBanner';
import StopListScreen from '../components/StopListScreen';
import AlertsScreen from '../components/AlertsScreen';
import ProfileScreen from '../components/ProfileScreen';
import HistoryScreen from '../components/HistoryScreen';
import SettingsScreen from '../components/SettingsScreen';
import BottomNav from '../components/BottomNav';

const MAX_ALERTS = 50;

const TABS = [
  { key: 'map', icon: '🗺️', label: 'Bản đồ' },
  { key: 'stops', icon: '📍', label: 'Lộ trình' },
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

  return (
    <div className={styles.app}>
      <StatusHeader
        wsStatus={wsStatus}
        batteryPercent={route ? batteryPercent : null}
        batteryKwh={route ? batteryKwh : null}
        load={route ? load : null}
      />

      <div className={styles.screen}>
        {activeTab === 'map' && (
          <>
            <MapView ref={mapApiRef} route={route} stations={stationsApi.stations} targetStop={driveEngine.targetStop} />
            <AlertBanner banner={banner} onClose={closeBanner} />
            <NextStopCard phase={driveEngine.phase} targetStop={driveEngine.targetStop} onComplete={handleCompleteStop} />
          </>
        )}
        {activeTab === 'stops' && <StopListScreen route={route} />}
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
          <SettingsScreen onBack={() => setProfileView('home')} />
        )}
      </div>

      <BottomNav tabs={TABS} active={activeTab} onChange={setActiveTab} />
    </div>
  );
}
