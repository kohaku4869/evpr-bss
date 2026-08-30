import { useMemo, useState } from 'react';
import ServiceTypeSelector from './ServiceTypeSelector';
import PackageFields from './PackageFields';
import RideFields from './RideFields';
import FoodFields from './FoodFields';
import { estimateFare } from '../pricing';
import styles from './BookingScreen.module.css';

const DEFAULT_FORM = { pickup: '', dropoff: '', itemDesc: '', weight: '', passengers: 1, restaurantId: '', note: '' };

function validate(serviceType, form) {
  if (serviceType === 'package') {
    if (!form.pickup.trim() || !form.dropoff.trim()) return 'Vui lòng nhập điểm lấy và điểm giao hàng.';
    if (!form.weight || Number(form.weight) <= 0) return 'Vui lòng nhập khối lượng hàng hóa hợp lệ.';
  } else if (serviceType === 'ride') {
    if (!form.pickup.trim() || !form.dropoff.trim()) return 'Vui lòng nhập điểm đón và điểm đến.';
  } else if (serviceType === 'food') {
    if (!form.restaurantId) return 'Vui lòng chọn quán ăn.';
    if (!form.dropoff.trim()) return 'Vui lòng nhập địa chỉ giao hàng.';
  }
  return '';
}

export default function BookingScreen({ onSubmit }) {
  const [serviceType, setServiceType] = useState('package');
  const [form, setForm] = useState(DEFAULT_FORM);
  const [error, setError] = useState('');

  const patchForm = (patch) => setForm((f) => ({ ...f, ...patch }));

  const handleServiceChange = (type) => {
    setServiceType(type);
    setError('');
  };

  const fare = useMemo(() => estimateFare(serviceType, form), [serviceType, form]);

  const handleSubmit = () => {
    const err = validate(serviceType, form);
    if (err) {
      setError(err);
      return;
    }
    setError('');
    onSubmit({ serviceType, form, fare });
  };

  return (
    <div className={styles.screen}>
      <div className={styles.title}>Bạn muốn đặt gì hôm nay?</div>
      <ServiceTypeSelector value={serviceType} onChange={handleServiceChange} />

      <div className={styles.form}>
        {serviceType === 'package' && <PackageFields value={form} onChange={patchForm} />}
        {serviceType === 'ride' && <RideFields value={form} onChange={patchForm} />}
        {serviceType === 'food' && <FoodFields value={form} onChange={patchForm} />}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.fareRow}>
        <span>Cước phí ước tính</span>
        <span className={styles.fareValue}>{fare}</span>
      </div>

      <button className={styles.submitBtn} onClick={handleSubmit}>Đặt ngay</button>
    </div>
  );
}
