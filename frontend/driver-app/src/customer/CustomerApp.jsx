import { useCallback, useState } from 'react';
import appStyles from '../App.module.css';
import BottomNav from '../components/BottomNav';
import BookingScreen from './components/BookingScreen';
import FindingDriverScreen from './components/FindingDriverScreen';
import TripTrackingScreen from './components/TripTrackingScreen';
import OrdersScreen from './components/OrdersScreen';
import CustomerProfileScreen from './components/CustomerProfileScreen';
import { STATUS_STEPS } from './statusSteps';
import { MOCK_ORDER_HISTORY, FOOD_RESTAURANTS } from './mockCustomerData';

const TABS = [
  { key: 'book', icon: '🧾', label: 'Đặt đơn' },
  { key: 'orders', icon: '📦', label: 'Đơn của tôi' },
  { key: 'profile', icon: '👤', label: 'Cá nhân' },
];

const FINDING_DURATION_MS = 2200;

function summarizeOrder(order) {
  if (order.serviceType === 'food') {
    const restaurant = FOOD_RESTAURANTS.find((r) => r.id === order.form.restaurantId);
    return `${restaurant?.name || 'Quán ăn'} → ${order.form.dropoff}`;
  }
  return `${order.form.pickup} → ${order.form.dropoff}`;
}

// Fully separate from the shipper flow: no real backend, no shared hooks —
// everything here is local component state seeded from mock data.
export default function CustomerApp({ onLogout }) {
  const [tab, setTab] = useState('book');
  const [stage, setStage] = useState('form'); // 'form' | 'finding' | 'tracking'
  const [activeOrder, setActiveOrder] = useState(null);
  const [statusIndex, setStatusIndex] = useState(0);
  const [orderHistory, setOrderHistory] = useState(MOCK_ORDER_HISTORY);

  const handleSubmitBooking = useCallback(({ serviceType, form, fare }) => {
    setActiveOrder({
      id: `o-${Date.now()}`,
      serviceType,
      form,
      fare,
      date: new Date().toLocaleDateString('vi-VN'),
    });
    setStatusIndex(0);
    setStage('finding');
    setTimeout(() => setStage('tracking'), FINDING_DURATION_MS);
  }, []);

  const handleAdvanceStatus = useCallback(() => {
    const steps = STATUS_STEPS[activeOrder.serviceType];
    if (statusIndex >= steps.length - 1) {
      setOrderHistory((prev) => [
        { id: activeOrder.id, date: activeOrder.date, type: activeOrder.serviceType, summary: summarizeOrder(activeOrder), fare: activeOrder.fare, status: 'Hoàn thành' },
        ...prev,
      ]);
      setActiveOrder(null);
      setStage('form');
      setStatusIndex(0);
    } else {
      setStatusIndex((idx) => idx + 1);
    }
  }, [activeOrder, statusIndex]);

  const handleCancelOrder = useCallback(() => {
    setOrderHistory((prev) => [
      { id: activeOrder.id, date: activeOrder.date, type: activeOrder.serviceType, summary: summarizeOrder(activeOrder), fare: activeOrder.fare, status: 'Đã hủy' },
      ...prev,
    ]);
    setActiveOrder(null);
    setStage('form');
    setStatusIndex(0);
  }, [activeOrder]);

  return (
    <div className={appStyles.app}>
      <div className={appStyles.screen}>
        {tab === 'book' && stage === 'form' && <BookingScreen onSubmit={handleSubmitBooking} />}
        {tab === 'book' && stage === 'finding' && <FindingDriverScreen />}
        {tab === 'book' && stage === 'tracking' && activeOrder && (
          <TripTrackingScreen
            order={activeOrder}
            statusIndex={statusIndex}
            onAdvance={handleAdvanceStatus}
            onCancel={handleCancelOrder}
          />
        )}
        {tab === 'orders' && (
          <OrdersScreen
            activeOrder={stage === 'tracking' ? activeOrder : null}
            history={orderHistory}
            onViewActive={() => setTab('book')}
          />
        )}
        {tab === 'profile' && <CustomerProfileScreen onLogout={onLogout} />}
      </div>

      <BottomNav tabs={TABS} active={tab} onChange={setTab} />
    </div>
  );
}
