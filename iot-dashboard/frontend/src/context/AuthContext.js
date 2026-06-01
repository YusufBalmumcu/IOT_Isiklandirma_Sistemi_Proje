import React, { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

const API = (process.env.REACT_APP_API_URL || '').trim().replace(/\/$/, '');

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('iot_token');
    const username = localStorage.getItem('iot_username');
    const role = localStorage.getItem('iot_role');
    return token ? { token, username, role } : null;
  });

  const login = useCallback(async (username, password) => {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Giriş başarısız');

    localStorage.setItem('iot_token', data.token);
    localStorage.setItem('iot_username', data.username);
    localStorage.setItem('iot_role', data.role);
    setUser({ token: data.token, username: data.username, role: data.role });
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('iot_token');
    localStorage.removeItem('iot_username');
    localStorage.removeItem('iot_role');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
