// Waypoints along Hanoi's perpetually congested arteries — same district
// spread as the real station list in backend/app/db/init_db.py, so the
// heatmap lines up with where the fleet/stations actually are. Coordinates
// are approximate (enough for a plausible visual, not real GPS traces).
export const ROAD_CORRIDORS = [
  {
    id: 'nguyen-trai',
    name: 'Nguyễn Trãi',
    baseIntensity: 0.8,
    waypoints: [
      [21.0050, 105.8195],
      [20.9990, 105.8090],
      [20.9954, 105.8072],
      [20.9880, 105.7980],
      [20.9820, 105.7880],
    ],
  },
  {
    id: 'giai-phong',
    name: 'Giải Phóng',
    baseIntensity: 0.7,
    waypoints: [
      [21.0007, 105.8505],
      [20.9950, 105.8460],
      [20.9880, 105.8420],
      [20.9750, 105.8400],
    ],
  },
  {
    id: 'lang',
    name: 'Láng',
    baseIntensity: 0.75,
    waypoints: [
      [21.0050, 105.8195],
      [21.0140, 105.8150],
      [21.0230, 105.8080],
      [21.0340, 105.8010],
    ],
  },
  {
    id: 'tran-duy-hung',
    name: 'Trần Duy Hưng',
    baseIntensity: 0.6,
    waypoints: [
      [21.0230, 105.8050],
      [21.0170, 105.8010],
      [21.0130, 105.7990],
    ],
  },
  {
    id: 'xa-dan',
    name: 'Xã Đàn',
    baseIntensity: 0.5,
    waypoints: [
      [21.0140, 105.8340],
      [21.0155, 105.8310],
      [21.0170, 105.8280],
    ],
  },
  {
    id: 'le-van-luong',
    name: 'Lê Văn Lương',
    baseIntensity: 0.65,
    waypoints: [
      [21.0060, 105.8050],
      [21.0020, 105.8020],
      [20.9980, 105.7990],
    ],
  },
];
