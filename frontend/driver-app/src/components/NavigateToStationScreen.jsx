import MapView from './MapView';
import SubScreenHeader from './SubScreenHeader';
import styles from './NavigateToStationScreen.module.css';

// Presentational-only "here's the nearest station" screen. Distance is a
// straight-line estimate (src/geo.js) computed client-side, not a real
// backend route patch — see plan doc for the follow-up to wire this to the
// actual reactive local-patch flow.
export default function NavigateToStationScreen({ route, stations, station, distanceKm, onClose }) {
  return (
    <div className={styles.wrap}>
      <SubScreenHeader title="Dẫn đường tới trạm đổi pin" onBack={onClose} />
      <div className={styles.mapWrap}>
        <MapView route={route} stations={stations} targetStop={null} />
      </div>
      <div className={styles.footer}>
        <div className={styles.info}>
          <div className={styles.stationName}>⚡ {station.name}</div>
          <div className={styles.distance}>Cách khoảng {distanceKm.toFixed(1)} km (đường chim bay)</div>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>Đóng</button>
      </div>
    </div>
  );
}
