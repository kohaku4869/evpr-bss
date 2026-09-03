import { useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Marker, Popup } from 'react-leaflet';
import HeatmapLayer from './HeatmapLayer';
import { shipperDivIcon } from '../mapIcons';
import styles from './MapPanel.module.css';

const HANOI_CENTER = [21.0245, 105.8412];
const STATUS_LABEL = { driving: 'Đang chạy', idle: 'Rảnh', charging: 'Đang đổi pin', maintenance: 'Bảo trì' };

function loadColor(load) {
  if (load >= 75) return '#f43f5e';
  if (load >= 50) return '#f59e0b';
  return '#14b8a6';
}

// Own pending state so toggling one station's popup button doesn't need to
// touch MapPanel-wide state for a dozen+ markers.
function StationMarker({ station: s, onToggleStation }) {
  const [pending, setPending] = useState(false);

  const handleToggle = async () => {
    setPending(true);
    await onToggleStation(s.id, !s.is_available);
    setPending(false);
  };

  return (
    <CircleMarker
      center={[s.lat, s.lng]}
      radius={7 + s.load / 12}
      pathOptions={{
        color: loadColor(s.load),
        fillColor: loadColor(s.load),
        fillOpacity: 0.55,
        weight: 2,
      }}
    >
      <Popup>
        <b>⚡ {s.name}</b><br />
        Tải hiện tại: <b>{s.load}%</b>{s.overloaded ? ' — QUÁ TẢI' : ''}<br />
        Pin đầy khả dụng: {s.availableBatteries} · Đang sạc: {s.chargingBatteries}<br />
        Trạng thái: {s.is_available ? 'Hoạt động' : '⚠️ Ngưng hoạt động'}
        {onToggleStation && (
          <div className={styles.popupAction}>
            <button className={styles.popupBtn} disabled={pending} onClick={handleToggle}>
              {pending ? '...' : s.is_available ? 'Khoá luồng điều hướng' : 'Mở lại'}
            </button>
          </div>
        )}
      </Popup>
    </CircleMarker>
  );
}

export default function MapPanel({ stations, shippers, heatPoints, orderHeatPoints, onToggleStation }) {
  const [heatMode, setHeatMode] = useState('traffic'); // 'traffic' | 'orders' | 'off'
  const activePoints = heatMode === 'traffic' ? heatPoints : heatMode === 'orders' ? orderHeatPoints : [];

  return (
    <div className={styles.wrap}>
      <div className={styles.heatToggle}>
        <button className={`${styles.toggleBtn} ${heatMode === 'traffic' ? styles.toggleActive : ''}`} onClick={() => setHeatMode('traffic')}>
          🚦 Tắc đường
        </button>
        <button className={`${styles.toggleBtn} ${heatMode === 'orders' ? styles.toggleActive : ''}`} onClick={() => setHeatMode('orders')}>
          📦 Đơn hàng
        </button>
        <button className={`${styles.toggleBtn} ${heatMode === 'off' ? styles.toggleActive : ''}`} onClick={() => setHeatMode('off')}>
          ✕ Ẩn
        </button>
      </div>

      <MapContainer center={HANOI_CENTER} zoom={12} zoomControl={true} className={styles.map}>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        <HeatmapLayer points={activePoints} />

        {stations.map((s) => (
          <StationMarker key={s.id} station={s} onToggleStation={onToggleStation} />
        ))}

        {shippers.map((s) => (
          <Marker key={s.id} position={[s.lat, s.lng]} icon={shipperDivIcon(s.status)}>
            <Popup>
              <b>🛵 {s.name}</b><br />
              Pin: {Math.round(s.battery)}% · {s.vehicleType}<br />
              Trạng thái: {STATUS_LABEL[s.status] || s.status}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
