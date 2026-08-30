import { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import { stopDivIcon, vehicleDivIcon } from '../../mapIcons';
import { fakeGeocode } from '../geofake';
import styles from './CustomerMapPreview.module.css';

// Lightweight, self-contained map for the customer flow: two fake-geocoded
// pins + a vehicle marker interpolated between them by `progress` (0..1).
// Deliberately does not reuse the shipper's MapView/drivingEngine — there is
// no real route/segments/stations data here, only a mock trip.
export default function CustomerMapPreview({ pickupLabel, dropoffLabel, progress = 0 }) {
  const pickup = useMemo(() => fakeGeocode(pickupLabel, 'pickup'), [pickupLabel]);
  const dropoff = useMemo(() => fakeGeocode(dropoffLabel, 'dropoff'), [dropoffLabel]);

  const vehiclePos = useMemo(() => [
    pickup[0] + (dropoff[0] - pickup[0]) * progress,
    pickup[1] + (dropoff[1] - pickup[1]) * progress,
  ], [pickup, dropoff, progress]);

  const center = useMemo(() => [
    (pickup[0] + dropoff[0]) / 2,
    (pickup[1] + dropoff[1]) / 2,
  ], [pickup, dropoff]);

  return (
    <MapContainer
      key={`${pickupLabel}|${dropoffLabel}`}
      center={center}
      zoom={13}
      zoomControl={false}
      dragging={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      className={styles.map}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <Polyline positions={[pickup, dropoff]} pathOptions={{ color: '#06b6d4', weight: 3.5, opacity: 0.8, dashArray: '4, 6' }} />
      <Marker position={pickup} icon={stopDivIcon('pickup', 'A')}>
        <Popup>{pickupLabel}</Popup>
      </Marker>
      <Marker position={dropoff} icon={stopDivIcon('delivery', 'B')}>
        <Popup>{dropoffLabel}</Popup>
      </Marker>
      <Marker position={vehiclePos} icon={vehicleDivIcon()} zIndexOffset={2000} />
    </MapContainer>
  );
}
