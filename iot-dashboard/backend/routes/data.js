const express = require('express');
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const fixTimezone = (rows) => rows.map(r => {
  if (r.timestamp && !r.timestamp.includes('Z')) {
    r.timestamp = r.timestamp.replace(' ', 'T') + 'Z';
  }
  return r;
});

router.get('/logs', authMiddleware, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const db = getDb();
  const logs = db.all(
    `SELECT * FROM sensor_logs ORDER BY timestamp DESC LIMIT ${limit}`
  );
  res.json(fixTimezone(logs));
});

router.get('/stats', authMiddleware, (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  const personRow = db.get(
    `SELECT person_count FROM sensor_logs WHERE event_type IN ('entry','exit','person_update') ORDER BY timestamp DESC LIMIT 1`
  );
  const lightRow = db.get(
    `SELECT light_state FROM sensor_logs WHERE event_type='light_change' ORDER BY timestamp DESC LIMIT 1`
  );
  const entries = db.get(`SELECT COUNT(*) as count FROM sensor_logs WHERE event_type='entry' AND date(timestamp)='${today}'`);
  const exits   = db.get(`SELECT COUNT(*) as count FROM sensor_logs WHERE event_type='exit' AND date(timestamp)='${today}'`);
  const lightOn = db.get(`SELECT COUNT(*) as count FROM sensor_logs WHERE event_type='light_change' AND light_state=1 AND date(timestamp)='${today}'`);
  const unacked = db.get(`SELECT COUNT(*) as count FROM alerts WHERE acknowledged=0`);

  res.json({
    person_count: personRow?.person_count ?? 0,
    light_state: lightRow?.light_state ?? 0,
    today_entries: entries?.count ?? 0,
    today_exits: exits?.count ?? 0,
    light_on_count_today: lightOn?.count ?? 0,
    unacknowledged_alerts: unacked?.count ?? 0
  });
});

router.get('/hourly', authMiddleware, (req, res) => {
  const db = getDb();
  const date = req.query.date || new Date().toISOString().split('T')[0];

  const rows = db.all(`
    SELECT strftime('%H', timestamp, 'localtime') as hour, MAX(person_count) as max_persons
    FROM sensor_logs
    WHERE event_type IN ('entry','exit','person_update')
      AND date(timestamp, 'localtime')='${date}' AND person_count IS NOT NULL
    GROUP BY hour ORDER BY hour
  `);

  const hourly = Array.from({ length: 24 }, (_, i) => {
    const h = String(i).padStart(2, '0');
    const found = rows.find(r => r.hour === h);
    return { hour: `${h}:00`, persons: found?.max_persons ?? 0 };
  });
  res.json(hourly);
});

router.get('/alerts', authMiddleware, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const db = getDb();
  const alerts = db.all(`SELECT * FROM alerts ORDER BY timestamp DESC LIMIT ${limit}`);
  res.json(fixTimezone(alerts));
});

router.post('/alerts/:id/acknowledge', authMiddleware, (req, res) => {
  const db = getDb();
  db.run('UPDATE alerts SET acknowledged=1 WHERE id=?', [req.params.id]);
  res.json({ message: 'Uyarı onaylandı' });
});

module.exports = router;
