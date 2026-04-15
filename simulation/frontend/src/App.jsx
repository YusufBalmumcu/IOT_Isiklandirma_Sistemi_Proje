import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';

// Sabit API URL'si
const API_BASE_URL = 'http://127.0.0.1:8000';

function App() {
  const [historyData, setHistoryData] = useState([]);
  const [statsData, setStatsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  const fetchData = async () => {
    try {
      const [historyRes, statsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/sensors/history`),
        axios.get(`${API_BASE_URL}/api/sensors/stats`),
      ]);

      // Zaman formatını HH:mm:ss'ye çevirelim
      const formattedHistory = historyRes.data.map((item) => ({
        ...item,
        formattedTime: new Date(item.timestamp).toLocaleTimeString('tr-TR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      }));

      setHistoryData(formattedHistory);
      setStatsData(statsRes.data);
      setError(null);
      setLoading(false);
    } catch (err) {
      console.error('Veri çekme hatası:', err);
      // İlk yüklemede hata olursa göster, polling sırasında son veriler kalsın
      if (historyData.length === 0) {
        setError('Verilere erişilemiyor. Lütfen backend bağlantısını kontrol edin.');
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchData(); // İlk veri çekimi
    const interval = setInterval(fetchData, 2000); // 2 saniyede bir güncelle
    return () => clearInterval(interval); // Temizle
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 transition-colors duration-300">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-slate-200 dark:border-slate-700 border-t-indigo-500 dark:border-t-indigo-400 rounded-full animate-spin"></div>
          <p className="text-lg font-medium tracking-wide">Sensör verileri yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
        <div className="max-w-md p-8 bg-white dark:bg-slate-800 border border-red-100 dark:border-red-900/30 rounded-2xl shadow-xl shadow-red-500/10 dark:shadow-red-900/20 text-center">
          <div className="w-16 h-16 mx-auto mb-4 text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Bağlantı Hatası</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 md:p-8 lg:p-12 font-sans overflow-hidden transition-colors duration-300">
      <header className="max-w-7xl mx-auto mb-10 flex justify-between items-center">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight transition-colors">
            Simülasyon Paneli
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm font-medium transition-colors">
            Gerçek zamanlı çevresel veri analizi
          </p>
        </div>
        <button
          onClick={toggleTheme}
          className="p-3 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:shadow-md transition-all focus:outline-none"
          aria-label="Gece modunu değiştir"
        >
          {isDark ? <MoonIcon /> : <DayIcon />}
        </button>
      </header>

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Sıcaklık Satırı */}
        <SensorRow
          title="Sıcaklık"
          unit="°C"
          dataKey="sicaklik"
          color="#f43f5e"
          gradientId="colorSicaklik"
          icon={<ThermometerIcon />}
          historyData={historyData}
          stats={statsData?.sicaklik}
          isDark={isDark}
        />

        {/* Nem Satırı */}
        <SensorRow
          title="Bağıl Nem"
          unit="%"
          dataKey="nem"
          color="#3b82f6"
          gradientId="colorNem"
          icon={<DropletIcon />}
          historyData={historyData}
          stats={statsData?.nem}
          isDark={isDark}
        />

        {/* Işık Satırı */}
        <SensorRow
          title="Işık Miktarı"
          unit="Lux"
          dataKey="isik"
          color="#f59e0b"
          gradientId="colorIsik"
          icon={<SunIcon />}
          historyData={historyData}
          stats={statsData?.isik}
          isDark={isDark}
        />
      </div>
    </div>
  );
}

// Alt Bileşenler

function SensorRow({ title, unit, dataKey, color, gradientId, icon, historyData, stats, isDark }) {
  if (!stats) return null;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Grafik Bölümü (%70) */}
      <div className="lg:w-[70%] bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-slate-100 dark:border-slate-700/50 transition-all duration-300">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl" style={{ backgroundColor: `${color}15`, color: color }}>
            {icon}
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 transition-colors">
            {title} Geçmişi
          </h2>
        </div>
        
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={isDark ? 0.4 : 0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#f1f5f9'} />
              <XAxis 
                dataKey="formattedTime" 
                tick={{ fontSize: 12, fill: isDark ? '#94a3b8' : '#64748b' }} 
                tickMargin={10}
                axisLine={false}
                tickLine={false}
                minTickGap={20}
              />
              <YAxis 
                tick={{ fontSize: 12, fill: isDark ? '#94a3b8' : '#64748b' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `${value}`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: isDark ? '#1e293b' : '#fff', 
                  borderRadius: '12px', 
                  border: isDark ? '1px solid #334155' : 'none', 
                  boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)',
                  fontWeight: '500',
                  color: isDark ? '#f8fafc' : '#1e293b'
                }}
                itemStyle={{ color: color, fontWeight: '700' }}
                formatter={(value) => [`${value} ${unit}`, title]}
                labelStyle={{ color: '#64748b', marginBottom: '4px' }}
              />
              <Area 
                type="monotone" 
                dataKey={dataKey} 
                stroke={color} 
                strokeWidth={3}
                fillOpacity={1} 
                fill={`url(#${gradientId})`} 
                animationDuration={1500}
                isAnimationActive={false} // Polling sırasında animasyonun sürekli baştan oynamaması için
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* İstatistikler Kartı (%30) */}
      <div className="lg:w-[30%] bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-slate-100 dark:border-slate-700/50 flex flex-col justify-between transition-all duration-300">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center transition-colors">
          <div className="w-2 h-6 rounded-full mr-3" style={{ backgroundColor: color }}></div>
          İstatistikler <span className="ml-2 text-sm font-normal text-slate-400 dark:text-slate-500">({unit})</span>
        </h3>
        
        <div className="flex-1 flex flex-col justify-center space-y-3">
          <StatItem label="Min" value={stats.min} color={color} unit={unit} />
          <StatItem label="Max" value={stats.max} color={color} unit={unit} />
          <StatItem label="Ortalama" value={stats.ort?.toFixed(1) || stats.ort} color={color} unit={unit} />
          <StatItem label="Varyans" value={stats.varyans?.toFixed(2) || stats.varyans} color={color} unit="" isVariance />
        </div>
        
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between text-xs font-medium text-slate-400 dark:text-slate-500 transition-colors">
          <span>Canlı Veri Akışı</span>
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 dark:bg-emerald-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 dark:bg-emerald-400"></span>
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Aktif</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function StatItem({ label, value, color, unit, isVariance = false }) {
  return (
    <div className="flex justify-between items-center group p-3 rounded-xl transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30">
      <span className="text-slate-500 dark:text-slate-400 font-medium transition-colors">{label}</span>
      <div className="text-right flex items-baseline">
        <span className="text-2xl font-bold text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
          {value !== undefined ? value : '--'}
        </span>
        {!isVariance && <span className="text-sm font-medium ml-1.5 text-slate-400 dark:text-slate-500">{unit}</span>}
      </div>
    </div>
  );
}

// İkonlar
function ThermometerIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.24a4.5 4.5 0 1 0 5 0z"></path>
    </svg>
  );
}

function DropletIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"></path>
    </svg>
  );
}

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"></circle>
      <path d="M12 2v2"></path>
      <path d="M12 20v2"></path>
      <path d="m4.93 4.93 1.41 1.41"></path>
      <path d="m17.66 17.66 1.41 1.41"></path>
      <path d="M2 12h2"></path>
      <path d="M20 12h2"></path>
      <path d="m6.34 17.66-1.41 1.41"></path>
      <path d="m19.07 4.93-1.41 1.41"></path>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
    </svg>
  );
}

function DayIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"></circle>
      <line x1="12" y1="1" x2="12" y2="3"></line>
      <line x1="12" y1="21" x2="12" y2="23"></line>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
      <line x1="1" y1="12" x2="3" y2="12"></line>
      <line x1="21" y1="12" x2="23" y2="12"></line>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    </svg>
  );
}

export default App;
