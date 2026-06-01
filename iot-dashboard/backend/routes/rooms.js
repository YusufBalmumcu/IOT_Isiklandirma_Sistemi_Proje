const express = require('express');
const { getDb, saveDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const { publishLightCommand, publishModeCommand, broadcast } = require('../mqttService');

const router = express.Router();

// Tüm odaları getir (durum bilgisiyle birlikte)
router.get('/', authMiddleware, (req, res) => {
  const db = getDb();
  const rooms = db.all('SELECT * FROM rooms ORDER BY id ASC');
  res.json(rooms);
});

// Yeni oda ekle (sadece admin)
router.post('/', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Sadece admin oda ekleyebilir' });

  const { name, mqtt_cmd_topic, light_mode = 'manual', ldr_threshold = 1500 } = req.body;
  if (!name || !mqtt_cmd_topic) return res.status(400).json({ error: 'name ve mqtt_cmd_topic zorunlu' });

  const db = getDb();
  try {
    const result = db.run(
      `INSERT INTO rooms (name, mqtt_cmd_topic, light_mode, ldr_threshold) VALUES (?, ?, ?, ?)`,
      [name, mqtt_cmd_topic, light_mode, ldr_threshold]
    );
    saveDb();
    res.json({ message: 'Oda oluşturuldu', id: result.lastInsertRowid, name });
  } catch (err) {
    res.status(400).json({ error: 'Bu oda adı zaten mevcut' });
  }
});

// Tek oda detayı
router.get('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const room = db.get('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
  if (!room) return res.status(404).json({ error: 'Oda bulunamadı' });
  res.json(room);
});

// Mod değiştir: manual | auto | half_auto
router.put('/:id/mode', authMiddleware, (req, res) => {
  const { mode } = req.body;
  const validModes = ['manual', 'auto', 'half_auto'];
  if (!validModes.includes(mode)) {
    return res.status(400).json({ error: `Geçersiz mod. Seçenekler: ${validModes.join(', ')}` });
  }

  const db = getDb();
  const room = db.get('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
  if (!room) return res.status(404).json({ error: 'Oda bulunamadı' });

  db.run(
    `UPDATE rooms SET light_mode = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [mode, req.params.id]
  );

  // Mod değişikliğini logla
  db.run(
    `INSERT INTO light_control_logs
      (room_id, triggered_by, action, new_mode, ldr_value, ldr_threshold, person_count, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.params.id,
      `user:${req.user.username}`,
      'MODE_CHANGE',
      mode,
      room.current_ldr,
      room.ldr_threshold,
      room.person_count,
      `Mod değiştirildi: ${room.light_mode} → ${mode}`
    ]
  );

  // ESP32'ye mod komutunu gönder
  publishModeCommand(room.mqtt_cmd_topic, mode, room.ldr_threshold);
  saveDb();

  // WebSocket üzerinden tüm UI'lara duyur
  broadcast({
    type: 'room_update',
    room_id: parseInt(req.params.id),
    room_name: room.name,
    light_state: room.light_state,
    light_mode: mode,
    ldr_threshold: room.ldr_threshold,
    timestamp: new Date().toISOString()
  });

  res.json({ message: 'Mod güncellendi', room_id: req.params.id, mode });
});

// LDR eşiğini güncelle
router.put('/:id/threshold', authMiddleware, (req, res) => {
  const threshold = parseInt(req.body.ldr_threshold);
  if (isNaN(threshold) || threshold < 0 || threshold > 4095) {
    return res.status(400).json({ error: 'ldr_threshold 0-4095 arasında olmalı' });
  }

  const db = getDb();
  const room = db.get('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
  if (!room) return res.status(404).json({ error: 'Oda bulunamadı' });

  db.run(
    `UPDATE rooms SET ldr_threshold = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [threshold, req.params.id]
  );

  // Eşik değişikliğini logla
  db.run(
    `INSERT INTO light_control_logs
      (room_id, triggered_by, action, ldr_threshold, note)
     VALUES (?, ?, ?, ?, ?)`,
    [
      req.params.id,
      `user:${req.user.username}`,
      'THRESHOLD_CHANGE',
      threshold,
      `LDR eşiği değiştirildi: ${room.ldr_threshold} → ${threshold}`
    ]
  );

  // Yeni eşiği ESP32'ye bildir
  publishModeCommand(room.mqtt_cmd_topic, room.light_mode, threshold);
  saveDb();

  // WebSocket üzerinden tüm UI'lara duyur
  broadcast({
    type: 'room_update',
    room_id: parseInt(req.params.id),
    room_name: room.name,
    light_state: room.light_state,
    light_mode: room.light_mode,
    ldr_threshold: threshold,
    timestamp: new Date().toISOString()
  });

  res.json({ message: 'LDR eşiği güncellendi', room_id: req.params.id, ldr_threshold: threshold });
});

// Manuel ışık kontrolü (sadece manual modda veya admin override)
router.post('/:id/light', authMiddleware, (req, res) => {
  const { state } = req.body; // 0 veya 1
  if (state !== 0 && state !== 1) {
    return res.status(400).json({ error: 'state 0 (kapat) veya 1 (aç) olmalı' });
  }

  const db = getDb();
  const room = db.get('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
  if (!room) return res.status(404).json({ error: 'Oda bulunamadı' });

  // Viewer rolü sadece manual modda kontrol edebilir
  if (req.user.role !== 'admin' && room.light_mode !== 'manual') {
    return res.status(403).json({
      error: `Oda şu an '${room.light_mode}' modunda. Manuel kontrol için modu 'manual' yapın.`
    });
  }

  db.run(
    `UPDATE rooms SET light_state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [state, req.params.id]
  );

  // Işık kontrol logu
  db.run(
    `INSERT INTO light_control_logs
      (room_id, triggered_by, action, new_light_state, ldr_value, ldr_threshold, person_count, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.params.id,
      `user:${req.user.username}`,
      state === 1 ? 'LIGHT_ON' : 'LIGHT_OFF',
      state,
      room.current_ldr,
      room.ldr_threshold,
      room.person_count,
      `Manuel kontrol: ${state === 1 ? 'Açıldı' : 'Kapatıldı'}`
    ]
  );

  // ESP32'ye ışık komutunu gönder
  publishLightCommand(room.mqtt_cmd_topic, state);
  saveDb();

  // WebSocket üzerinden tüm UI'lara duyur
  broadcast({
    type: 'room_update',
    room_id: parseInt(req.params.id),
    room_name: room.name,
    light_state: state,
    light_mode: room.light_mode,
    ldr_threshold: room.ldr_threshold,
    timestamp: new Date().toISOString()
  });

  res.json({
    message: `Işık ${state === 1 ? 'açıldı' : 'kapatıldı'}`,
    room_id: req.params.id,
    light_state: state
  });
});

// Oda bazlı ışık kontrol logları
router.get('/:id/logs', authMiddleware, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const db = getDb();

  const room = db.get('SELECT id, name FROM rooms WHERE id = ?', [req.params.id]);
  if (!room) return res.status(404).json({ error: 'Oda bulunamadı' });

  const logs = db.all(
    `SELECT * FROM light_control_logs WHERE room_id = ? ORDER BY timestamp DESC LIMIT ${limit}`,
    [req.params.id]
  );

  // Timestamp düzeltmesi
  const fixed = logs.map(r => {
    if (r.timestamp && !r.timestamp.includes('Z')) {
      r.timestamp = r.timestamp.replace(' ', 'T') + 'Z';
    }
    return r;
  });

  res.json({ room, logs: fixed });
});

// Tüm odaların ışık kontrol logları
router.get('/logs/all', authMiddleware, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const db = getDb();

  const logs = db.all(
    `SELECT lcl.*, r.name as room_name
     FROM light_control_logs lcl
     LEFT JOIN rooms r ON r.id = lcl.room_id
     ORDER BY lcl.timestamp DESC LIMIT ${limit}`
  );

  const fixed = logs.map(r => {
    if (r.timestamp && !r.timestamp.includes('Z')) {
      r.timestamp = r.timestamp.replace(' ', 'T') + 'Z';
    }
    return r;
  });

  res.json(fixed);
});

module.exports = router;
