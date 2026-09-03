import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import { stopDivIcon, stationDivIcon, vehicleDivIcon } from '../mapIcons';
import styles from './MapView.module.css';

const HANOI_CENTER = [21.0285, 105.8542];

function MapController({ mapRef }) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);
  return null;
}

function routeStyle(route) {
  return (feature) => {
    const props = feature.properties || {};
    const fromStop = route.stops?.[props.from_sequence_index];
    const toStop = route.stops?.[props.to_sequence_index];
    const isFrozen = fromStop?.status === 'done' && toStop?.status === 'done';
    return {
      color: isFrozen ? '#10b981' : '#14b8a6',
      weight: isFrozen ? 3.5 : 5,
      opacity: isFrozen ? 0.75 : 0.95,
      dashArray: isFrozen ? '6, 6' : null,
    };
  };
}

const MapView = forwardRef(function MapView({ route, stations, targetStop }, ref) {
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const hasFitBounds = useRef(false);
  const lastPannedStopKey = useRef(null);
  const [vehiclePos, setVehiclePos] = useState(null);

  useImperativeHandle(ref, () => ({
    setVehiclePosition(pos) {
      if (!pos) return;
      if (markerRef.current) {
        markerRef.current.setLatLng(pos);
      } else {
        setVehiclePos(pos);
      }
    },
  }), []);

  // Fit bounds once, the first time we have anything to show (matches app.js).
  useEffect(() => {
    if (hasFitBounds.current || !mapRef.current) return;
    const points = [
      ...stations.map((s) => [s.lat, s.lng]),
      ...((route?.stops || []).filter((s) => s.lat != null).map((s) => [s.lat, s.lng])),
    ];
    if (points.length > 0) {
      mapRef.current.fitBounds(points, { padding: [40, 40] });
      hasFitBounds.current = true;
    }
  }, [stations, route]);

  // Pan toward the next stop when it changes (not every animation tick).
  useEffect(() => {
    if (!targetStop || !mapRef.current) return;
    const key = `${targetStop.stop_type}-${targetStop.ref_order_id}-${targetStop.ref_station_id}`;
    if (lastPannedStopKey.current === key) return;
    lastPannedStopKey.current = key;
    if (targetStop.lat != null && targetStop.lng != null) {
      mapRef.current.panTo([targetStop.lat, targetStop.lng]);
    }
  }, [targetStop]);

  const hasGeometry = route?.geometry?.features?.length > 0;
  const fallbackPolyline = !hasGeometry && route?.stops?.length > 1
    ? route.stops.map((s) => [s.lat, s.lng])
    : null;

  return (
    <MapContainer
      center={HANOI_CENTER}
      zoom={13}
      zoomControl={false}
      className={styles.map}
    >
      <MapController mapRef={mapRef} />
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />

      {stations.map((st) => {
        const isOnRoute = (route?.stops || []).some(
          (s) => s.stop_type === 'swap_station' && s.ref_station_id === st.id
        );
        return (
          <Marker
            key={st.id}
            position={[st.lat, st.lng]}
            icon={stationDivIcon(st.is_available, isOnRoute)}
            zIndexOffset={isOnRoute ? 1000 : 0}
          >
            <Popup>
              <b>{st.is_available ? '⚡' : '✕ Ngưng hoạt động'} {st.name}</b><br />
              {isOnRoute && <><b>📍 Trạm trong lộ trình của bạn</b><br /></>}
              Phí đổi pin: ${st.cost_swap?.toFixed?.(1)}
            </Popup>
          </Marker>
        );
      })}

      {hasGeometry && (
        <GeoJSON
          key={`geo-${route.id}-${route.total_cost}-${route.total_distance_km}-${route.stops.length}`}
          data={route.geometry}
          style={routeStyle(route)}
        />
      )}
      {fallbackPolyline && (
        <Polyline positions={fallbackPolyline} pathOptions={{ color: '#14b8a6', weight: 3.5, opacity: 0.8, dashArray: '4, 6' }} />
      )}

      {(route?.stops || []).map((stop) => {
        if (stop.lat == null || stop.lng == null) return null;
        if (stop.stop_type === 'depot') {
          return (
            <Marker key="depot" position={[stop.lat, stop.lng]} icon={stopDivIcon('depot', 'D')}>
              <Popup>🏢 Kho xuất phát<br />{stop.label || 'Kho trung tâm'}</Popup>
            </Marker>
          );
        }
        if (stop.stop_type === 'pickup') {
          return (
            <Marker key={`pickup-${stop.ref_order_id}`} position={[stop.lat, stop.lng]} icon={stopDivIcon('pickup', `P${stop.ref_order_id ?? ''}`)}>
              <Popup>📦 Lấy hàng #{stop.ref_order_id}<br />Khối lượng: {stop.weight}kg</Popup>
            </Marker>
          );
        }
        if (stop.stop_type === 'delivery') {
          return (
            <Marker key={`delivery-${stop.ref_order_id}`} position={[stop.lat, stop.lng]} icon={stopDivIcon('delivery', `D${stop.ref_order_id ?? ''}`)}>
              <Popup>🏠 Giao hàng #{stop.ref_order_id}<br />Khối lượng: {stop.weight}kg</Popup>
            </Marker>
          );
        }
        return null;
      })}

      {vehiclePos && (
        <Marker ref={markerRef} position={vehiclePos} icon={vehicleDivIcon()} zIndexOffset={2000}>
          <Popup>🛵 Tài xế #1 (Đang hoạt động)</Popup>
        </Marker>
      )}
    </MapContainer>
  );
});

export default MapView;
