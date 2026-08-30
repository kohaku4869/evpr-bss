import { useEffect, useState } from 'react';
import SplashScreen from './components/SplashScreen';
import LoginScreen from './components/LoginScreen';
import ShipperApp from './shipper/ShipperApp';
import CustomerApp from './customer/CustomerApp';

const SPLASH_DURATION_MS = 1500;

export default function App() {
  const [appPhase, setAppPhase] = useState('splash'); // 'splash' | 'login' | 'main'
  const [role, setRole] = useState(null); // 'customer' | 'shipper'

  useEffect(() => {
    const timer = setTimeout(() => setAppPhase('login'), SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = (selectedRole) => {
    setRole(selectedRole);
    setAppPhase('main');
  };

  const handleLogout = () => {
    setRole(null);
    setAppPhase('login');
  };

  if (appPhase === 'splash') return <SplashScreen />;
  if (appPhase === 'login') return <LoginScreen onLogin={handleLogin} />;

  return role === 'shipper'
    ? <ShipperApp onLogout={handleLogout} />
    : <CustomerApp onLogout={handleLogout} />;
}
