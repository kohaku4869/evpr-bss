import { useMemo, useState } from 'react';
import { EV_COST_PER_KM_VND, AVG_KM_PER_ORDER, ALLOWANCE_PER_ORDER_VND } from '../data/energyAssumptions';
import styles from './DriverSettlementSection.module.css';

const STATUS_LABEL = { driving: 'Đang chạy', idle: 'Rảnh', charging: 'Đang đổi pin', maintenance: 'Bảo trì' };

function toCsv(rows) {
  const header = ['Tên', 'Biển số', 'Loại xe', 'Pin (%)', 'Đơn hôm nay', 'Đánh giá', 'Phí năng lượng (đ)', 'Phụ cấp (đ)', 'Thực nhận (đ)'];
  const lines = rows.map((r) => [
    r.name, r.plate, r.vehicleType, Math.round(r.battery), r.completedOrdersToday, r.rating,
    r.energyCost, r.allowance, r.netPay,
  ].join(','));
  return [header.join(','), ...lines].join('\n');
}

function downloadCsv(csv, filename) {
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DriverSettlementSection({ shippers }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const rows = useMemo(() => shippers.map((s) => {
    const energyCost = Math.round(s.completedOrdersToday * AVG_KM_PER_ORDER * EV_COST_PER_KM_VND);
    const allowance = s.completedOrdersToday * ALLOWANCE_PER_ORDER_VND;
    return { ...s, energyCost, allowance, netPay: allowance - energyCost };
  }), [shippers]);

  const filtered = rows.filter((r) => {
    const matchesSearch = search.trim() === ''
      || r.name.toLowerCase().includes(search.toLowerCase())
      || r.plate.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>🧾 Tài xế & Đối soát ca ({filtered.length})</h2>
        <button className={styles.exportBtn} onClick={() => downloadCsv(toCsv(filtered), 'doi-soat-ca.csv')}>
          ⬇️ Xuất CSV
        </button>
      </div>

      <div className={styles.filterBar}>
        <input
          className={styles.search}
          placeholder="🔍 Tìm theo tên hoặc biển số..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className={styles.chips}>
          {['all', 'driving', 'idle', 'charging', 'maintenance'].map((key) => (
            <button
              key={key}
              className={`${styles.chip} ${statusFilter === key ? styles.chipActive : ''}`}
              onClick={() => setStatusFilter(key)}
            >
              {key === 'all' ? 'Tất cả' : STATUS_LABEL[key]}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Tài xế</th>
              <th>Biển số</th>
              <th>Loại xe</th>
              <th>Pin</th>
              <th>Trạng thái</th>
              <th>Đơn hôm nay</th>
              <th>Đánh giá</th>
              <th>Phí năng lượng</th>
              <th>Phụ cấp</th>
              <th>Thực nhận</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td className={styles.mono}>{r.plate}</td>
                <td>{r.vehicleType}</td>
                <td className={`${styles.mono} ${r.battery <= 20 ? styles.warn : ''}`}>{Math.round(r.battery)}%</td>
                <td>{STATUS_LABEL[r.status]}</td>
                <td className={styles.mono}>{r.completedOrdersToday}</td>
                <td className={styles.mono}>⭐ {r.rating}</td>
                <td className={styles.mono}>-{r.energyCost.toLocaleString('vi-VN')}đ</td>
                <td className={styles.mono}>{r.allowance.toLocaleString('vi-VN')}đ</td>
                <td className={`${styles.mono} ${styles.netPay}`}>{r.netPay.toLocaleString('vi-VN')}đ</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={10} className={styles.emptyRow}>Không tìm thấy tài xế phù hợp.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
