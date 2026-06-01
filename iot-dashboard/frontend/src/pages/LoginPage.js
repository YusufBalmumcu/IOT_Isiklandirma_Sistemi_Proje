import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.username, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.icon}>💡</div>
          <h1 style={styles.title}>Akıllı Işıklandırma</h1>
          <p style={styles.subtitle}>Sistem Kontrol Paneli</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Kullanıcı Adı</label>
            <input
              type="text"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              style={styles.input}
              placeholder="admin"
              autoComplete="username"
              required
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Şifre</label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              style={styles.input}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" style={styles.btn} disabled={loading}>
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>

        <p style={styles.hint}>Varsayılan: admin / admin123</p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    fontFamily: "'Segoe UI', system-ui, sans-serif"
  },
  card: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 16,
    padding: '2.5rem',
    width: '100%',
    maxWidth: 400,
    boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
  },
  header: { textAlign: 'center', marginBottom: '2rem' },
  icon: { fontSize: 48, marginBottom: '0.5rem' },
  title: { color: '#f1f5f9', fontSize: 24, fontWeight: 700, margin: 0 },
  subtitle: { color: '#94a3b8', fontSize: 14, marginTop: 4 },
  form: { display: 'flex', flexDirection: 'column', gap: '1.25rem' },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { color: '#94a3b8', fontSize: 13, fontWeight: 500 },
  input: {
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: 8,
    padding: '0.75rem 1rem',
    color: '#f1f5f9',
    fontSize: 15,
    outline: 'none',
    transition: 'border-color 0.2s'
  },
  error: {
    background: '#450a0a',
    border: '1px solid #7f1d1d',
    color: '#fca5a5',
    borderRadius: 8,
    padding: '0.75rem',
    fontSize: 14,
    textAlign: 'center'
  },
  btn: {
    background: '#3b82f6',
    border: 'none',
    borderRadius: 8,
    padding: '0.875rem',
    color: 'white',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s',
    marginTop: '0.5rem'
  },
  hint: { color: '#475569', fontSize: 12, textAlign: 'center', marginTop: '1rem' }
};
