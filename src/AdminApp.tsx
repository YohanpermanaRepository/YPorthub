import React, { useState, useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import { decodeJwtPayload } from './utils/auth';

const AdminApp: React.FC = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('authToken'));
  const [authInfo, setAuthInfo] = useState<{ username: string; role: string } | null>(() => {
    const t = localStorage.getItem('authToken');
    if (!t) return null;
    const payload = decodeJwtPayload(t);
    if (!payload?.username || !payload?.role) return null;
    return { username: payload.username, role: String(payload.role) };
  });

  useEffect(() => {
    const handleStorageChange = () => {
      const nextToken = localStorage.getItem('authToken');
      setToken(nextToken);
      if (nextToken) {
        const payload = decodeJwtPayload(nextToken);
        if (payload?.username && payload?.role) {
          setAuthInfo({ username: payload.username, role: String(payload.role) });
        } else {
          setAuthInfo(null);
        }
      } else {
        setAuthInfo(null);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const handleLoginSuccess = (newToken: string) => {
    localStorage.setItem('authToken', newToken);
    setToken(newToken);
    const payload = decodeJwtPayload(newToken);
    if (payload?.username && payload?.role) {
      setAuthInfo({ username: payload.username, role: String(payload.role) });
    } else {
      setAuthInfo(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    setToken(null);
    setAuthInfo(null);
  };

  return (
    <div>
      {token ? (
        <DashboardPage onLogout={handleLogout} authInfo={authInfo} />
      ) : (
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  );
};

export default AdminApp;
