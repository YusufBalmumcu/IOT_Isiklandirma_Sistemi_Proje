import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

// WebSocket doğrudan backend'e bağlanır (proxy'ye güvenmez)
const WS_URL = process.env.REACT_APP_API_URL
  ? process.env.REACT_APP_API_URL.replace('http', 'ws')
  : `ws://${window.location.hostname}:3001`;

export function useWebSocket() {
  const { user } = useAuth();
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const listenersRef = useRef(new Set());

  const subscribe = useCallback((fn) => {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  }, []);

  useEffect(() => {
    if (!user?.token) return;

    function connect() {
      const ws = new WebSocket(`${WS_URL}/ws?token=${user.token}`);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        setTimeout(connect, 4000);
      };
      ws.onerror = () => ws.close();

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          setLastUpdate(data);
          listenersRef.current.forEach(fn => fn(data));
        } catch {}
      };
    }

    connect();
    return () => wsRef.current?.close();
  }, [user?.token]);

  return { connected, lastUpdate, subscribe };
}
