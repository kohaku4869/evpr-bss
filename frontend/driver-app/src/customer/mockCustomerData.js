// Static mock data for the customer ordering flow — presentational only, kept
// entirely separate from the shipper's real backend-backed data/hooks.

export const MOCK_CUSTOMER = {
  name: 'Phạm Thu Hà',
  phone: '090 123 4567',
  email: 'thuha.pham@example.com',
  avatarInitials: 'TH',
  memberSince: 'Tháng 6, 2025',
  totalOrders: 34,
  points: 1250,
};

export const MOCK_MATCHED_DRIVER = {
  name: 'Trần Minh Khoa',
  vehiclePlate: '30-F2 567.89',
  rating: 4.9,
  avatarInitials: 'MK',
};

export const FOOD_RESTAURANTS = [
  { id: 'r1', name: 'Phở Thìn Bờ Hồ', category: 'Phở' },
  { id: 'r2', name: 'Cơm Tấm Sài Gòn', category: 'Cơm' },
  { id: 'r3', name: 'Trà Sữa Gong Cha', category: 'Đồ uống' },
  { id: 'r4', name: 'Bún Chả Hương Liên', category: 'Bún' },
];

export const SERVICE_LABEL = {
  package: 'Giao hàng',
  ride: 'Xe máy',
  food: 'Đặt đồ ăn',
};

export const SERVICE_TYPES = [
  { key: 'package', icon: '📦', label: SERVICE_LABEL.package, desc: 'Gửi hàng hóa, tài liệu nhanh chóng' },
  { key: 'ride', icon: '🛵', label: SERVICE_LABEL.ride, desc: 'Di chuyển bằng xe máy trong nội thành' },
  { key: 'food', icon: '🍜', label: SERVICE_LABEL.food, desc: 'Đặt món từ nhà hàng, quán ăn yêu thích' },
];

export const MOCK_ORDER_HISTORY = [
  { id: 'o-208', date: '29/08/2026', type: 'food', summary: 'Phở Thìn Bờ Hồ → 12 Trần Duy Hưng', fare: '45.000đ', status: 'Hoàn thành' },
  { id: 'o-207', date: '27/08/2026', type: 'package', summary: 'Giao tài liệu, 2kg', fare: '28.000đ', status: 'Hoàn thành' },
  { id: 'o-206', date: '25/08/2026', type: 'ride', summary: 'Cầu Giấy → Hoàn Kiếm', fare: '35.000đ', status: 'Hoàn thành' },
  { id: 'o-205', date: '22/08/2026', type: 'package', summary: 'Giao quà tặng, 1.5kg', fare: '22.000đ', status: 'Đã hủy' },
];
