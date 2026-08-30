// Static mock data for the profile / history / settings screens — presentational
// only, not backed by any real API (there is no auth/driver-profile backend).

export const MOCK_DRIVER = {
  name: 'Nguyễn Văn Long',
  driverCode: 'SHIPPER-001',
  vehiclePlate: '29-AB1 234.56',
  avatarInitials: 'NL',
  rating: 4.8,
  totalTrips: 128,
  totalDistanceKm: 2350,
  memberSince: 'Tháng 3, 2024',
};

export const MOCK_TRIP_HISTORY = [
  { id: 't-105', date: '30/08/2026', stopsCount: 9, distanceKm: 18.4, status: 'Hoàn thành' },
  { id: 't-104', date: '29/08/2026', stopsCount: 7, distanceKm: 14.1, status: 'Hoàn thành' },
  { id: 't-103', date: '28/08/2026', stopsCount: 11, distanceKm: 22.6, status: 'Hoàn thành' },
  { id: 't-102', date: '27/08/2026', stopsCount: 6, distanceKm: 12.8, status: 'Hoàn thành' },
  { id: 't-101', date: '26/08/2026', stopsCount: 8, distanceKm: 16.3, status: 'Đã hủy' },
];
