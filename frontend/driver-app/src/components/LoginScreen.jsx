import { useState } from 'react';
import styles from './LoginScreen.module.css';

export default function LoginScreen({ onLogin }) {
  const [role, setRole] = useState('customer'); // 'customer' | 'shipper'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const isShipper = role === 'shipper';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ số điện thoại và mật khẩu.');
      return;
    }
    setError('');
    onLogin(role);
  };

  return (
    <div className={styles.login}>
      <div className={styles.brand}>
        <div className={styles.logo}>⚡</div>
        <div className={styles.title}>{isShipper ? 'Đăng nhập tài xế' : 'Đăng nhập khách hàng'}</div>
        <div className={styles.subtitle}>
          {isShipper ? 'Đăng nhập để bắt đầu nhận chuyến giao hàng' : 'Đăng nhập để đặt xe, đặt đồ ăn và gửi hàng'}
        </div>
      </div>

      <div className={styles.roleSwitch}>
        <button
          type="button"
          className={`${styles.roleBtn} ${role === 'customer' ? styles.active : ''}`}
          onClick={() => setRole('customer')}
        >
          Khách hàng
        </button>
        <button
          type="button"
          className={`${styles.roleBtn} ${role === 'shipper' ? styles.active : ''}`}
          onClick={() => setRole('shipper')}
        >
          Tài xế
        </button>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="username">Số điện thoại</label>
          <input
            id="username"
            className={styles.input}
            type="tel"
            placeholder="09xxxxxxxx"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="password">Mật khẩu</label>
          <input
            id="password"
            className={styles.input}
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <button type="submit" className={styles.submitBtn}>Đăng nhập</button>
        <div className={styles.forgot}>Quên mật khẩu?</div>
      </form>

      <div className={styles.footnote}>EVPR-BSS · Hệ thống giao hàng xe điện có trạm đổi pin</div>
    </div>
  );
}
