import { haversineKm } from '../geo';
import { useStationLoad } from '../hooks/useStationLoad';
import styles from './StationStatusScreen.module.css';

const OVERLOAD_THRESHOLD = 75;

function crowdLevel(load) {
  if (load >= OVERLOAD_THRESHOLD) return { label: 'Đông, ít pin sẵn sàng', cls: 'busy' };
  if (load >= 50) return { label: 'Bình thường', cls: 'moderate' };
  return { label: 'Nhiều pin sẵn sàng', cls: 'quiet' };
}

export default function StationStatusScreen({ stations, referenceLat, referenceLng }) {
  const load = useStationLoad(stations);

  const rows = stations
    .map((s) => ({
      ...s,
      distanceKm: referenceLat != null && referenceLng != null
        ? haversineKm(referenceLat, referenceLng, s.lat, s.lng)
        : null,
    }))
    .sort((a, b) => {
      if (a.distanceKm == null || b.distanceKm == null) return a.name.localeCompare(b.name);
      return a.distanceKm - b.distanceKm;
    });

  if (!rows.length) {
    return <div className={styles.list}><div className={styles.empty}>Chưa tải được danh sách trạm.</div></div>;
  }

  return (
    <div className={styles.list}>
      {rows.map((s) => {
        const crowd = s.is_available ? crowdLevel(load[s.id] ?? 0) : null;
        return (
          <div key={s.id} className={styles.item}>
            <div className={styles.left}>
              <span className={styles.icon}>⚡</span>
              <div className={styles.info}>
                <div className={styles.name}>{s.name}</div>
                <div className={styles.meta}>
                  {s.distanceKm != null && <span>{s.distanceKm.toFixed(1)}km</span>}
                  <span>Phí đổi: {(s.cost_swap * 1000).toLocaleString('vi-VN')} đ</span>
                </div>
              </div>
            </div>
            <span className={`${styles.badge} ${s.is_available ? styles[crowd.cls] : styles.down}`}>
              {s.is_available ? crowd.label : 'Ngưng hoạt động'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
