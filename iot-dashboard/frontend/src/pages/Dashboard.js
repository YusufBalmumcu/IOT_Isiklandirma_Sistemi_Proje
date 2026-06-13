import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';

const API = (process.env.REACT_APP_API_URL || '').trim().replace(/\/$/, '');

// LDR karanlık kontrolü: simülatör 0/1, gerçek ESP32 analog (0-4095, >2500 = karanlık)
const LDR_THRESHOLD = 2500;
function isDark(ldrValue) {
  if (ldrValue === null || ldrValue === undefined) return false;
  if (ldrValue === 1) return true;  // simülatör modu
  if (ldrValue === 0) return false; // simülatör modu
  return ldrValue > LDR_THRESHOLD;  // gerçek analog değer
}

async function apiFetch(path, token, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`${API}${path}`, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'İşlem başarısız');
  return data;
}

const translations = {
  tr: {
    title: 'Akıllı Işıklandırma',
    live: 'CANLI',
    noConn: 'BAĞLANTI YOK',
    logout: 'Çıkış',
    personCount: 'Odadaki Kişi Sayısı',
    lightStatus: 'Işık Durumu',
    ldr: 'LDR (Ortam Işığı)',
    activeAlerts: 'Aktif Uyarılar',
    on: 'AÇIK',
    off: 'KAPALI',
    darkRoom: '🌙 Karanlık',
    dimRoom: '☁️ Loş',
    brightRoom: '☀️ Aydınlık',
    unackedCount: 'Onaylanmamış uyarı',
    sensor1: 'İç Kapı Sensörü',
    sensor2: 'Dış Kapı Sensörü',
    hourlyPersons: 'Saatlik Kişi Sayısı',
    liveLdr: 'Canlı LDR Değeri',
    eventLog: 'Olay Günlüğü',
    refresh: '↻ Yenile',
    waitingData: 'Veri bekleniyor...',
    time: 'Zaman',
    event: 'Olay',
    person: 'Kişi',
    light: 'Işık',
    ldrVal: 'LDR',
    direction: 'Yön',
    entry: 'Giriş',
    exit: 'Çıkış',
    sensor: 'Sensör',
    status: 'Durum',
    in: '→ İçeri',
    out: '← Dışarı',
    todayEntries: (e, x) => `Bugün: ${e} giriş, ${x} çıkış`,
    todayLights: (c) => `Bugün ${c} kez açıldı`,
    ok: 'Tamam',
    home: 'Ana Sayfa',
    rooms: 'Odalar',
    sensors: 'Sensörler',
    latestEvents: 'Son Olaylar',
    distance: 'Mesafe',
    motionDetected: 'Cisim Çok Yakın!',
    noMotion: 'Normal (Boş)',
    
    // Yeni Eklenenler
    mode: 'Mod',
    ldrThreshold: 'LDR Eşiği',
    addRoom: 'Oda Ekle',
    roomName: 'Oda Adı',
    mqttTopic: 'MQTT Komut Konusu',
    selectRoom: 'Oda Seçin',
    manual: 'Manuel',
    auto: 'Otomatik',
    halfAuto: 'Yarı Oto',
    cancel: 'İptal',
    save: 'Kaydet',
    roomsTitle: 'Odalar ve Kontrol',
    totalPersonCount: 'Evdeki Toplam Kişi',
    globalLightStatus: 'Işık Durumu (Tüm Odalar)',
    livePersonHistory: 'Canlı Kişi Grafiği',
  },
  en: {
    title: 'Smart Lighting',
    live: 'LIVE',
    noConn: 'NO CONN',
    logout: 'Logout',
    personCount: 'People in Room',
    lightStatus: 'Light Status',
    ldr: 'LDR (Light Level)',
    activeAlerts: 'Active Alerts',
    on: 'ON',
    off: 'OFF',
    darkRoom: '🌙 Dark',
    dimRoom: '☁️ Dim',
    brightRoom: '☀️ Bright',
    unackedCount: 'Unacknowledged',
    sensor1: 'Inner Sensor',
    sensor2: 'Outer Sensor',
    hourlyPersons: 'Hourly Persons',
    liveLdr: 'Live LDR Value',
    eventLog: 'Event Log',
    refresh: '↻ Refresh',
    waitingData: 'Waiting for data...',
    time: 'Time',
    event: 'Event',
    person: 'Person',
    light: 'Light',
    ldrVal: 'LDR',
    direction: 'Dir',
    entry: 'Entry',
    exit: 'Exit',
    sensor: 'Sensor',
    status: 'Status',
    in: '→ In',
    out: '← Out',
    todayEntries: (e, x) => `Today: ${e} in, ${x} out`,
    todayLights: (c) => `On ${c} times today`,
    ok: 'OK',
    home: 'Home',
    rooms: 'Rooms',
    sensors: 'Sensors',
    latestEvents: 'Latest Events',
    distance: 'Distance',
    motionDetected: 'Object Very Close!',
    noMotion: 'Normal (Clear)',

    // New additions
    mode: 'Mode',
    ldrThreshold: 'LDR Threshold',
    addRoom: 'Add Room',
    roomName: 'Room Name',
    mqttTopic: 'MQTT Command Topic',
    selectRoom: 'Select Room',
    manual: 'Manual',
    auto: 'Auto',
    halfAuto: 'Half Auto',
    cancel: 'Cancel',
    save: 'Save',
    roomsTitle: 'Rooms & Control',
    totalPersonCount: 'Total People in House',
    globalLightStatus: 'Light Status (All Rooms)',
    livePersonHistory: 'Live Occupancy Chart',
  }
};

const themes = {
  dark: {
    bg: '#0f172a',
    cardBg: '#1e293b',
    border: '#334155',
    text: '#e2e8f0',
    textSec: '#94a3b8',
    textMuted: '#64748b',
    borderLight: '#475569',
    successBg: '#052e16',
    errorBg: '#450a0a',
    warnBg: '#431407',
    infoBg: '#1e3a5f',
    purpleBg: '#2e1065',
    chartGrid: '#1e293b',
  },
  light: {
    bg: '#f8fafc',
    cardBg: '#ffffff',
    border: '#e2e8f0',
    text: '#0f172a',
    textSec: '#475569',
    textMuted: '#94a3b8',
    borderLight: '#cbd5e1',
    successBg: '#dcfce7',
    errorBg: '#fee2e2',
    warnBg: '#ffedd5',
    infoBg: '#e0f2fe',
    purpleBg: '#f3e8ff',
    chartGrid: '#e2e8f0',
  }
};

function StatusBadge({ connected, lang, theme }) {
  const t = translations[lang];
  const c = themes[theme];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: connected ? c.successBg : c.errorBg,
      border: `1px solid ${connected ? (theme==='dark'?'#166534':'#86efac') : (theme==='dark'?'#7f1d1d':'#fca5a5')}`,
      color: connected ? (theme==='dark'?'#4ade80':'#166534') : (theme==='dark'?'#f87171':'#991b1b'),
      borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: connected ? '#4ade80' : '#ef4444',
        boxShadow: connected ? '0 0 6px #4ade80' : 'none',
        animation: connected ? 'pulse 2s infinite' : 'none'
      }} />
      {connected ? t.live : t.noConn}
    </span>
  );
}

function MetricCard({ label, value, unit, icon, color = '#3b82f6', subtext, theme }) {
  const c = themes[theme];
  return (
    <div style={{
      background: c.cardBg, border: `1px solid ${c.border}`,
      borderRadius: 12, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: 8
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ color: c.textSec, fontSize: 13, fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 22 }}>{icon}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ color, fontSize: 32, fontWeight: 700, lineHeight: 1 }}>{value}</span>
        {unit && <span style={{ color: c.textMuted, fontSize: 14 }}>{unit}</span>}
      </div>
      {subtext && <span style={{ color: c.textSec, fontSize: 12 }}>{subtext}</span>}
    </div>
  );
}

function AlertBanner({ alerts, onAck, token, lang, theme }) {
  const t = translations[lang];
  const c = themes[theme];
  const unacked = alerts.filter(a => !a.acknowledged);
  if (unacked.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1.5rem' }}>
      {unacked.slice(0, 3).map(alert => (
        <div key={alert.id} style={{
          background: alert.severity === 'critical' ? c.errorBg : c.warnBg,
          border: `1px solid ${alert.severity === 'critical' ? (theme==='dark'?'#7f1d1d':'#fca5a5') : (theme==='dark'?'#7c2d12':'#fdba74')}`,
          borderRadius: 10, padding: '0.875rem 1rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>{alert.severity === 'critical' ? '🚨' : '⚠️'}</span>
            <div>
              <p style={{ color: theme==='dark'?'#fca5a5':'#991b1b', fontSize: 14, fontWeight: 600, margin: 0 }}>{alert.message}</p>
              <p style={{ color: c.textSec, fontSize: 11, margin: 0 }}>{new Date(alert.timestamp).toLocaleString(lang==='tr'?'tr-TR':'en-US')}</p>
            </div>
          </div>
          <button
            onClick={() => onAck(alert.id)}
            style={{
              background: 'transparent', border: `1px solid ${c.borderLight}`,
              borderRadius: 6, color: c.textSec, padding: '4px 10px',
              fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap'
            }}
          >
            {t.ok}
          </button>
        </div>
      ))}
    </div>
  );
}

function LogTable({ logs, lang, theme }) {
  const t = translations[lang];
  const c = themes[theme];
  
  const typeLabels = {
    entry: { label: t.entry, darkColor: '#4ade80', lightColor: '#166534', bg: c.successBg },
    exit: { label: t.exit, darkColor: '#f87171', lightColor: '#991b1b', bg: c.errorBg },
    light_change: { label: t.light, darkColor: '#fbbf24', lightColor: '#b45309', bg: c.warnBg },
    sensor_data: { label: t.sensor, darkColor: '#60a5fa', lightColor: '#1d4ed8', bg: c.infoBg },
    status: { label: t.status, darkColor: '#a78bfa', lightColor: '#6b21a8', bg: c.purpleBg },
    person_update: { label: t.person, darkColor: '#3b82f6', lightColor: '#1d4ed8', bg: c.infoBg }
  };

  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, minHeight: 0 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, position: 'relative' }}>
        <thead style={{ position: 'sticky', top: 0, background: c.cardBg, zIndex: 10 }}>
          <tr style={{ borderBottom: `1px solid ${c.border}` }}>
            {[t.time, t.event, t.person, t.light, t.ldrVal, t.direction].map(h => (
              <th key={h} style={{ color: c.textMuted, fontWeight: 500, padding: '8px 12px', textAlign: 'left' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map(log => {
            const tl = typeLabels[log.event_type] || { label: log.event_type, darkColor: c.textSec, lightColor: c.textSec, bg: c.cardBg };
            return (
              <tr key={log.id} style={{ borderBottom: `1px solid ${theme==='dark'?'#1e293b':'#f1f5f9'}` }}>
                <td style={{ color: c.textMuted, padding: '8px 12px', whiteSpace: 'nowrap' }}>
                  {new Date(log.timestamp).toLocaleString(lang==='tr'?'tr-TR':'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <span style={{ background: tl.bg, color: theme==='dark' ? tl.darkColor : tl.lightColor, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                    {tl.label}
                  </span>
                </td>
                <td style={{ color: c.text, padding: '8px 12px' }}>{log.person_count ?? '—'}</td>
                <td style={{ padding: '8px 12px' }}>
                  {log.light_state !== null ? (
                    <span style={{ color: log.light_state ? '#fbbf24' : c.textSec }}>
                      {log.light_state ? (lang==='tr'?'● Açık':'● On') : (lang==='tr'?'○ Kapalı':'○ Off')}
                    </span>
                  ) : '—'}
                </td>
                <td style={{ color: c.textSec, padding: '8px 12px' }}>{log.ldr_value !== null ? (isDark(log.ldr_value) ? (lang==='tr'?'Karanlık':'Dark') : (lang==='tr'?'Aydınlık':'Bright')) : '—'}</td>
                <td style={{ color: c.textSec, padding: '8px 12px' }}>
                  {log.direction === 'in' ? t.in : log.direction === 'out' ? t.out : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SidebarBtn({ icon, label, active, onClick, c }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
      background: active ? '#3b82f6' : 'transparent',
      color: active ? '#fff' : c.textSec,
      border: 'none', borderRadius: 8, cursor: 'pointer',
      fontSize: 15, fontWeight: active ? 600 : 500,
      textAlign: 'left', transition: 'all 0.2s'
    }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      {label}
    </button>
  );
}

// ==========================
// VIEWS
// ==========================

function HomeView({ t, c, theme, lang, logs, stats, hourly, alerts, liveData }) {
  const lightIsOn = liveData.light_state === 1;
  const personCount = liveData.person_count || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1, minHeight: 0 }}>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <MetricCard label={t.totalPersonCount} value={personCount} icon={personCount > 0 ? '🧑‍🤝‍🧑' : '🚶'} color={personCount > 0 ? (theme==='dark'?'#4ade80':'#16a34a') : c.textMuted} subtext={t.todayEntries(stats.today_entries ?? 0, stats.today_exits ?? 0)} theme={theme} />
        <MetricCard label={t.globalLightStatus} value={lightIsOn ? t.on : t.off} icon={lightIsOn ? '💡' : '🌑'} color={lightIsOn ? '#fbbf24' : c.textSec} subtext={t.todayLights(stats.light_on_count_today ?? 0)} theme={theme} />
        <MetricCard label={t.ldr} value={isDark(liveData.ldr_value) ? (lang === 'tr' ? 'Karanlık' : 'Dark') : (lang === 'tr' ? 'Aydınlık' : 'Bright')} icon={isDark(liveData.ldr_value) ? '🌙' : '☀️'} color={isDark(liveData.ldr_value) ? '#fbbf24' : '#60a5fa'} subtext={`LDR: ${liveData.ldr_value ?? 0}`} theme={theme} />
        <MetricCard label={t.activeAlerts} value={alerts.filter(a => !a.acknowledged).length} icon="🔔" color={alerts.filter(a => !a.acknowledged).length > 0 ? (theme==='dark'?'#f87171':'#dc2626') : (theme==='dark'?'#4ade80':'#16a34a')} subtext={t.unackedCount} theme={theme} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1rem', flex: 1, minHeight: 320 }}>
        <div style={{ background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 12, padding: '1.25rem', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <h3 style={{ color: c.textSec, fontSize: 13, fontWeight: 600, marginTop: 0, marginBottom: '1rem' }}>{t.hourlyPersons}</h3>
          <div style={{ flex: 1, minHeight: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourly.filter(h => h.persons > 0 || hourly.indexOf(h) < 24)}>
                <CartesianGrid strokeDasharray="3 3" stroke={c.chartGrid} />
                <XAxis dataKey="hour" tick={{ fill: c.textSec, fontSize: 11 }} interval={3} />
                <YAxis tick={{ fill: c.textSec, fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: c.cardBg, border: `1px solid ${c.border}`, color: c.text }} />
                <Bar dataKey="persons" fill="#3b82f6" radius={[4, 4, 0, 0]} name={t.person} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 12, padding: '1.25rem', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ color: c.textSec, fontSize: 13, fontWeight: 600, margin: 0 }}>{t.eventLog}</h3>
          </div>
          <LogTable logs={logs.slice(0, 10)} lang={lang} theme={theme} />
        </div>
      </div>
    </div>
  );
}

function RoomsView({ t, c, rooms, onToggleLight, onChangeMode, onThresholdChange, onAddRoomClick, isAdmin }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, color: c.text, fontSize: 22, fontWeight: 700 }}>{t.roomsTitle}</h2>
        {isAdmin && (
          <button
            onClick={onAddRoomClick}
            style={{
              background: '#3b82f6', border: 'none', borderRadius: 8,
              color: '#fff', padding: '10px 20px', fontSize: 14,
              fontWeight: 600, cursor: 'pointer', display: 'flex',
              alignItems: 'center', gap: 8, transition: 'all 0.2s'
            }}
          >
            ➕ {t.addRoom}
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {rooms.map(room => {
          const lightOn = room.light_state === 1;
          const personCount = room.person_count || 0;

          return (
            <div key={room.id} style={{
              background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 16, overflow: 'hidden',
              boxShadow: lightOn ? '0 4px 20px rgba(251, 191, 36, 0.15)' : 'none', transition: 'all 0.3s',
              display: 'flex', flexDirection: 'column'
            }}>
              {/* Card Header */}
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 18, color: c.text, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                  🚪 {room.name}
                </h3>
                <span style={{ 
                  background: lightOn ? '#fef3c7' : c.bg, color: lightOn ? '#d97706' : c.textSec,
                  padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700
                }}>
                  {room.light_mode === 'manual' ? t.manual : room.light_mode === 'auto' ? t.auto : t.halfAuto}
                </span>
              </div>
              
              {/* Card Body */}
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1 }}>
                
                {/* Bulb Icon and Toggles */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div 
                    onClick={() => room.light_mode === 'manual' && onToggleLight(room.id, room.light_state)}
                    style={{ 
                      width: 64, height: 64, borderRadius: '50%', background: lightOn ? '#fbbf24' : c.bg,
                      display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: 30,
                      boxShadow: lightOn ? '0 0 24px #fbbf24' : 'none', transition: 'all 0.3s',
                      cursor: room.light_mode === 'manual' ? 'pointer' : 'not-allowed',
                      border: `1px solid ${c.border}`
                    }}
                    title={room.light_mode === 'manual' ? 'Işığı aç/kapat' : 'Işığı manuel kontrol etmek için modu Manuel yapın'}
                  >
                    💡
                  </div>

                  {/* Mode Select Buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ color: c.textSec, fontSize: 13, fontWeight: 500 }}>{t.mode}</span>
                    <div style={{ display: 'flex', background: c.bg, padding: 4, borderRadius: 12, border: `1px solid ${c.border}` }}>
                      {['manual', 'auto', 'half_auto'].map(m => (
                        <button
                          key={m}
                          onClick={() => onChangeMode(room.id, m)}
                          style={{
                            background: room.light_mode === m ? '#3b82f6' : 'transparent',
                            color: room.light_mode === m ? '#fff' : c.textSec,
                            border: 'none', borderRadius: 8, padding: '8px 16px',
                            fontSize: 13, fontWeight: 600, cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          {m === 'manual' ? t.manual : m === 'auto' ? t.auto : t.halfAuto}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: '1rem', width: '100%', justifyContent: 'space-around', background: c.bg, padding: '10px', borderRadius: 10, border: `1px solid ${c.border}` }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: c.textMuted, fontSize: 11, marginBottom: 4 }}>{t.personCount}</div>
                    <div style={{ color: c.text, fontSize: 18, fontWeight: 700 }}>{personCount}</div>
                  </div>
                  <div style={{ width: 1, background: c.border }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: c.textMuted, fontSize: 11, marginBottom: 4 }}>{t.ldrVal}</div>
                    <div style={{ color: c.text, fontSize: 16, fontWeight: 700 }}>{isDark(room.current_ldr) ? t.darkRoom : t.brightRoom}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SensorsView({ t, c, lang, rooms, selectedRoomId, onRoomSelect, liveData, ldrHistory, personHistory }) {
  const activeRoom = rooms.find(r => r.id === selectedRoomId) || rooms[0];
  const s1Val = liveData.sensor1_distance || 0;
  const s2Val = liveData.sensor2_distance || 0;
  const pct = Math.min(100, (s1Val / 200) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Room Selector */}
      {rooms.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: c.cardBg, border: `1px solid ${c.border}`, padding: '10px 16px', borderRadius: 10 }}>
          <span style={{ color: c.textSec, fontSize: 14, fontWeight: 500 }}>{t.selectRoom}:</span>
          <select
            value={selectedRoomId || ''}
            onChange={(e) => onRoomSelect(parseInt(e.target.value))}
            style={{
              background: c.bg, border: `1px solid ${c.border}`, color: c.text,
              borderRadius: 6, padding: '6px 12px', outline: 'none', cursor: 'pointer',
              fontWeight: 600
            }}
          >
            {rooms.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Live Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
        {/* LDR Chart */}
        <div style={{ background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 12, padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: c.textSec, fontSize: 14 }}>{t.liveLdr} {activeRoom ? `(${activeRoom.name})` : ''}</h3>
          {ldrHistory.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={ldrHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke={c.chartGrid} />
                <XAxis dataKey="t" tick={{ fill: c.textSec, fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fill: c.textSec, fontSize: 11 }} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ background: c.cardBg, border: `1px solid ${c.border}`, color: c.text }} formatter={(value) => [`${value} ${isDark(value) ? (lang==='tr'?'(Karanlık)':'(Dark)') : (lang==='tr'?'(Aydınlık)':'(Bright)')}`, t.ldrVal]} />
                <Line type="stepAfter" dataKey="v" stroke="#fbbf24" dot={false} strokeWidth={3} name={t.ldrVal} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.textSec }}>
              {t.waitingData}
            </div>
          )}
        </div>

        {/* Live Person Count Chart */}
        <div style={{ background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 12, padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: c.textSec, fontSize: 14 }}>{t.livePersonHistory} {activeRoom ? `(${activeRoom.name})` : ''}</h3>
          {personHistory.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={personHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke={c.chartGrid} />
                <XAxis dataKey="t" tick={{ fill: c.textSec, fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fill: c.textSec, fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: c.cardBg, border: `1px solid ${c.border}`, color: c.text }} name={t.person} />
                <Line type="stepAfter" dataKey="v" stroke="#3b82f6" dot={false} strokeWidth={3} name={t.person} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.textSec }}>
              {t.waitingData}
            </div>
          )}
        </div>
      </div>

      {/* Sensor Distance */}
      <div style={{ background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem', borderBottom: `1px solid ${c.border}` }}>
          <h3 style={{ margin: 0, color: c.textSec, fontSize: 14 }}>🚪 {activeRoom?.name} - {t.distance} Ölçümü</h3>
        </div>
        
        <div style={{ padding: '3rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2rem', flexWrap: 'wrap' }}>
          {/* Inner Sensor (S1) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: 54, fontWeight: 800, color: c.text }}>{s1Val.toFixed(1)} <span style={{fontSize: 24, color: c.textSec}}>cm</span></div>
              <div style={{ color: c.textMuted, marginTop: 8, fontSize: 16 }}>{t.sensor1}</div>
              
              <div style={{ marginTop: '2.5rem', padding: '12px 24px', borderRadius: 30, background: s1Val < 50 ? c.warnBg : c.successBg, color: s1Val < 50 ? '#d97706' : '#16a34a', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>{s1Val < 50 ? '⚠️' : '✅'}</span>
                {s1Val < 50 ? t.motionDetected : t.noMotion}
              </div>
            </div>
            
            <div style={{ height: 250, width: 60, background: c.bg, borderRadius: 30, position: 'relative', overflow: 'hidden', border: `1px solid ${c.border}` }}>
              <div style={{ 
                position: 'absolute', bottom: 0, left: 0, right: 0, height: `${pct}%`,
                background: 'linear-gradient(to top, #3b82f6, #60a5fa)',
                transition: 'height 0.3s ease-out'
              }} />
              <div style={{ position: 'absolute', width: '100%', bottom: '25%', borderTop: `2px dashed ${s1Val < 50 ? '#ef4444' : 'rgba(255,255,255,0.4)'}`, zIndex: 2 }} />
            </div>
          </div>

          <div style={{ width: 1, height: 200, background: c.border, margin: '0 2rem' }}></div>

          {/* Outer Sensor (S2) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: 54, fontWeight: 800, color: c.text }}>{s2Val.toFixed(1)} <span style={{fontSize: 24, color: c.textSec}}>cm</span></div>
              <div style={{ color: c.textMuted, marginTop: 8, fontSize: 16 }}>{t.sensor2}</div>
              
              <div style={{ marginTop: '2.5rem', padding: '12px 24px', borderRadius: 30, background: s2Val < 50 ? c.warnBg : c.successBg, color: s2Val < 50 ? '#d97706' : '#16a34a', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>{s2Val < 50 ? '⚠️' : '✅'}</span>
                {s2Val < 50 ? t.motionDetected : t.noMotion}
              </div>
            </div>
            
            <div style={{ height: 250, width: 60, background: c.bg, borderRadius: 30, position: 'relative', overflow: 'hidden', border: `1px solid ${c.border}` }}>
              <div style={{ 
                position: 'absolute', bottom: 0, left: 0, right: 0, height: `${Math.min(100, (s2Val / 200) * 100)}%`,
                background: 'linear-gradient(to top, #8b5cf6, #a78bfa)',
                transition: 'height 0.3s ease-out'
              }} />
              <div style={{ position: 'absolute', width: '100%', bottom: '25%', borderTop: `2px dashed ${s2Val < 50 ? '#ef4444' : 'rgba(255,255,255,0.4)'}`, zIndex: 2 }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================
// MAIN DASHBOARD LAYOUT
// ==========================

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { connected, subscribe } = useWebSocket();

  const [lang, setLang] = useState('tr');
  const [theme, setTheme] = useState('dark');
  const [activeTab, setActiveTab] = useState('home');

  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  
  const [liveData, setLiveData] = useState({
    person_count: 0, light_state: 0, ldr_value: 0,
    sensor1_distance: 0, sensor2_distance: 0
  });
  const [stats, setStats] = useState({});
  const [logs, setLogs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [hourly, setHourly] = useState([]);
  const [ldrHistory, setLdrHistory] = useState([]);
  const [personHistory, setPersonHistory] = useState([]);

  // Room Ekleme State'leri
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [newRoomData, setNewRoomData] = useState({
    name: '',
    mqtt_cmd_topic: '',
    light_mode: 'manual',
    ldr_threshold: 1500
  });

  const isAdmin = user?.role === 'admin';

  const fetchAll = useCallback(async () => {
    try {
      const [s, l, a, h, rList] = await Promise.all([
        apiFetch('/api/data/stats', user.token),
        apiFetch('/api/data/logs?limit=50', user.token),
        apiFetch('/api/data/alerts?limit=20', user.token),
        apiFetch('/api/data/hourly', user.token),
        apiFetch('/api/rooms', user.token)
      ]);
      setStats(s);
      setLogs(l);
      setAlerts(a);
      setHourly(h);
      setRooms(rList);
      
      if (rList.length > 0 && !selectedRoomId) {
        setSelectedRoomId(rList[0].id);
      }
    } catch (err) {
      console.error('Veri alınamadı:', err);
      if (err.message.includes('token') || err.message.includes('Yetkilendirme') || err.message.includes('Geçersiz')) {
        logout();
      }
    }
  }, [user.token, selectedRoomId, logout]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  useEffect(() => {
    setLdrHistory([]);
    setPersonHistory([]);
  }, [selectedRoomId]);

  // WebSocket Güncellemeleri
  useEffect(() => {
    return subscribe((msg) => {
      // Mod veya ışık durumu değiştiğinde
      if (msg.type === 'room_update') {
        setRooms(prev => prev.map(r => r.id === msg.room_id ? {
          ...r,
          light_state: msg.light_state ?? r.light_state,
          light_mode: msg.triggered_by ?? r.light_mode
        } : r));

        if (msg.room_id === selectedRoomId) {
          setLiveData(prev => ({
            ...prev,
            light_state: msg.light_state ?? prev.light_state
          }));
        }
      }

      // Canlı sensör veya kişi verisi geldiğinde
      if (msg.type === 'sensor_update') {
        // Oda listesini güncelle (ilk odayı fallback olarak kullan)
        setRooms(prev => prev.map((r, i) => (r.id === msg.room_id || (msg.room_id == null && i === 0)) ? {
          ...r,
          current_ldr: msg.ldr_value ?? r.current_ldr,
          person_count: msg.person_count ?? r.person_count
        } : r));

        // Canlı veriyi her zaman güncelle (room_id eşleşmesi aranmaz)
        setLiveData(prev => ({
          person_count: msg.person_count ?? prev.person_count,
          light_state: msg.light_state ?? prev.light_state,
          ldr_value: msg.ldr_value ?? prev.ldr_value,
          sensor1_distance: msg.sensor1_distance ?? prev.sensor1_distance,
          sensor2_distance: msg.sensor2_distance ?? prev.sensor2_distance
        }));

        if (msg.ldr_value !== undefined) {
          setLdrHistory(prev => [
            ...prev.slice(-49),
            { t: new Date().toLocaleTimeString(lang==='tr'?'tr-TR':'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), v: msg.ldr_value }
          ]);
        }
        if (msg.person_count !== undefined) {
          setPersonHistory(prev => [
            ...prev.slice(-49),
            { t: new Date().toLocaleTimeString(lang==='tr'?'tr-TR':'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), v: msg.person_count }
          ]);
        }

        if (['entry', 'exit', 'light_change'].includes(msg.event_type)) {
          setLogs(prev => [{ id: Date.now(), ...msg, timestamp: msg.timestamp }, ...prev.slice(0, 49)]);
        }
      }

      if (msg.type === 'alert') {
        setAlerts(prev => [{ id: Date.now(), ...msg, acknowledged: 0 }, ...prev.slice(0, 19)]);
      }
    });
  }, [subscribe, lang, selectedRoomId]);

  // Manuel Işık Aç Kapa
  const handleToggleLight = async (roomId, currentState) => {
    try {
      const newState = currentState === 1 ? 0 : 1;
      await apiFetch(`/api/rooms/${roomId}/light`, user.token, 'POST', { state: newState });
      setRooms(prev => prev.map(r => r.id === roomId ? { ...r, light_state: newState } : r));
    } catch (err) {
      alert(err.message);
    }
  };

  // Mod Değiştirme
  const handleChangeMode = async (roomId, newMode) => {
    try {
      await apiFetch(`/api/rooms/${roomId}/mode`, user.token, 'PUT', { mode: newMode });
      setRooms(prev => prev.map(r => r.id === roomId ? { ...r, light_mode: newMode } : r));
    } catch (err) {
      alert(err.message);
    }
  };

  // LDR Eşik Değiştirme
  const handleThresholdChange = async (roomId, value) => {
    try {
      await apiFetch(`/api/rooms/${roomId}/threshold`, user.token, 'PUT', { ldr_threshold: parseInt(value) });
      setRooms(prev => prev.map(r => r.id === roomId ? { ...r, ldr_threshold: parseInt(value) } : r));
    } catch (err) {
      alert(err.message);
    }
  };

  // Yeni Oda Ekleme
  const handleAddRoom = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/rooms', user.token, 'POST', newRoomData);
      const createdRoom = {
        id: res.id,
        name: res.name,
        mqtt_cmd_topic: newRoomData.mqtt_cmd_topic,
        light_mode: newRoomData.light_mode,
        ldr_threshold: newRoomData.ldr_threshold,
        light_state: 0,
        person_count: 0,
        current_ldr: 0
      };
      setRooms(prev => [...prev, createdRoom]);
      setShowAddRoomModal(false);
      setNewRoomData({ name: '', mqtt_cmd_topic: '', light_mode: 'manual', ldr_threshold: 1500 });
      if (!selectedRoomId) setSelectedRoomId(res.id);
    } catch (err) {
      alert(err.message);
    }
  };

  const acknowledgeAlert = async (id) => {
    await apiFetch(`/api/data/alerts/${id}/acknowledge`, user.token, 'POST').catch(() => {});
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: 1 } : a));
  };

  const t = translations[lang];
  const c = themes[theme];

  // Global Metrikler
  const totalPeople = rooms.reduce((sum, r) => sum + (r.person_count || 0), 0);
  const anyLightOn = rooms.some(r => r.light_state === 1);
  const activeRoom = rooms.find(r => r.id === selectedRoomId) || rooms[0];

  const aggregatedLiveData = {
    person_count: totalPeople,
    light_state: anyLightOn ? 1 : 0,
    ldr_value: activeRoom ? activeRoom.current_ldr : liveData.ldr_value,
    sensor1_distance: liveData.sensor1_distance,
    sensor2_distance: liveData.sensor2_distance
  };

  const sortedLogs = [...logs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return (
    <div style={{ display: 'flex', height: '100vh', background: c.bg, color: c.text, transition: 'background 0.3s', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: ${c.bg}; }
        ::-webkit-scrollbar-thumb { background: ${c.border}; border-radius: 3px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes ticker-anim { 0% { transform: translateX(50vw); } 100% { transform: translateX(-100%); } }
        .ticker { display: inline-block; padding-left: 100%; animation: ticker-anim 20s linear infinite; }
      `}</style>

      {/* Sidebar */}
      <aside style={{ width: 260, background: c.cardBg, borderRight: `1px solid ${c.border}`, display: 'flex', flexDirection: 'column', transition: 'all 0.3s' }}>
        <div style={{ padding: '24px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${c.border}` }}>
          <span style={{ fontSize: 26 }}>💡</span>
          <span style={{ fontWeight: 800, fontSize: 18, color: c.text }}>{t.title}</span>
        </div>
        
        <div style={{ padding: '1.5rem 1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SidebarBtn icon="🏠" label={t.home} active={activeTab==='home'} onClick={()=>setActiveTab('home')} c={c} />
          <SidebarBtn icon="🚪" label={t.rooms} active={activeTab==='rooms'} onClick={()=>setActiveTab('rooms')} c={c} />
          <SidebarBtn icon="📡" label={t.sensors} active={activeTab==='sensors'} onClick={()=>setActiveTab('sensors')} c={c} />
        </div>
        
        <div style={{ padding: '1.5rem', borderTop: `1px solid ${c.border}`, display: 'flex', justifyContent: 'center' }}>
           <StatusBadge connected={connected} lang={lang} theme={theme} />
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <nav style={{ height: 70, background: c.cardBg, borderBottom: `1px solid ${c.border}`, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '0 2rem', gap: 20, transition: 'all 0.3s' }}>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} style={{ background: 'transparent', border: `1px solid ${c.border}`, borderRadius: 8, color: c.text, padding: '6px 10px', fontSize: 16, cursor: 'pointer' }}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button onClick={() => setLang(lang === 'tr' ? 'en' : 'tr')} style={{ background: 'transparent', border: `1px solid ${c.border}`, borderRadius: 8, color: c.text, padding: '6px 12px', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>
            {lang === 'tr' ? 'EN' : 'TR'}
          </button>
          
          <div style={{ width: 1, height: 28, background: c.border }} />
          
          <span style={{ color: c.textSec, fontSize: 14, fontWeight: 500 }}>👤 {user.username} ({user.role})</span>
          <button onClick={logout} style={{ background: '#ef4444', border: 'none', borderRadius: 8, color: '#fff', padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {t.logout}
          </button>
        </nav>

        {/* Scrollable View Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '2rem', minHeight: 0 }}>
           <AlertBanner alerts={alerts} onAck={acknowledgeAlert} token={user.token} lang={lang} theme={theme} />
           
           {activeTab === 'home' && (
             <HomeView 
               t={t} c={c} theme={theme} lang={lang} 
               logs={sortedLogs} stats={stats} hourly={hourly} 
               alerts={alerts} liveData={aggregatedLiveData} 
             />
           )}
           {activeTab === 'rooms' && (
             <RoomsView 
               t={t} c={c} rooms={rooms} 
               onToggleLight={handleToggleLight} 
               onChangeMode={handleChangeMode} 
               onThresholdChange={handleThresholdChange}
               onAddRoomClick={() => setShowAddRoomModal(true)}
               isAdmin={isAdmin}
             />
           )}
           {activeTab === 'sensors' && (
             <SensorsView 
               t={t} c={c} lang={lang} rooms={rooms} 
               selectedRoomId={selectedRoomId} 
               onRoomSelect={setSelectedRoomId} 
               liveData={liveData} ldrHistory={ldrHistory} personHistory={personHistory}
             />
           )}
        </div>
      </main>

      {/* Add Room Modal */}
      {showAddRoomModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)', display: 'flex',
          justifyContent: 'center', alignItems: 'center', zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <form onSubmit={handleAddRoom} style={{
            background: c.cardBg, border: `1px solid ${c.border}`,
            borderRadius: 16, width: '90%', maxWidth: 440, padding: '2rem',
            display: 'flex', flexDirection: 'column', gap: '1.25rem'
          }}>
            <h3 style={{ margin: 0, color: c.text, fontSize: 20, fontWeight: 700 }}>🚪 {t.addRoom}</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ color: c.textSec, fontSize: 13, fontWeight: 500 }}>{t.roomName}</label>
              <input
                type="text"
                required
                value={newRoomData.name}
                onChange={(e) => setNewRoomData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Örn: Mutfak, Salon"
                style={{
                  background: c.bg, border: `1px solid ${c.border}`, color: c.text,
                  borderRadius: 8, padding: '10px 14px', fontSize: 14, outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ color: c.textSec, fontSize: 13, fontWeight: 500 }}>{t.mqttTopic}</label>
              <input
                type="text"
                required
                value={newRoomData.mqtt_cmd_topic}
                onChange={(e) => setNewRoomData(prev => ({ ...prev, mqtt_cmd_topic: e.target.value }))}
                placeholder="Örn: iot_dash_abird_cmd/mutfak"
                style={{
                  background: c.bg, border: `1px solid ${c.border}`, color: c.text,
                  borderRadius: 8, padding: '10px 14px', fontSize: 14, outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ color: c.textSec, fontSize: 13, fontWeight: 500 }}>{t.mode}</label>
              <select
                value={newRoomData.light_mode}
                onChange={(e) => setNewRoomData(prev => ({ ...prev, light_mode: e.target.value }))}
                style={{
                  background: c.bg, border: `1px solid ${c.border}`, color: c.text,
                  borderRadius: 8, padding: '10px 14px', fontSize: 14, outline: 'none', cursor: 'pointer'
                }}
              >
                <option value="manual">{t.manual}</option>
                <option value="auto">{t.auto}</option>
                <option value="half_auto">{t.halfAuto}</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
              <button
                type="button"
                onClick={() => setShowAddRoomModal(false)}
                style={{
                  background: 'transparent', border: `1px solid ${c.border}`,
                  borderRadius: 8, color: c.textSec, padding: '10px 18px',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer'
                }}
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                style={{
                  background: '#3b82f6', border: 'none', borderRadius: 8,
                  color: '#fff', padding: '10px 20px', fontSize: 14,
                  fontWeight: 600, cursor: 'pointer'
                }}
              >
                {t.addRoom}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
