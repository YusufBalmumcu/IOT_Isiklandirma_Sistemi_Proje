const mqtt = require('mqtt');
const { getDb, saveDb } = require('./db/database');

// ─── Global LDR State ────────────────────────────────────────────────────────
// LDR tek sensör, tüm sistem için ortam ışığını ölçer
let globalLdrValue = 0;

// ─── Eşik değerleri ─────────────────────────────────────────────────────────
const THRESHOLDS = {
  sensor_distance: { max: 400, min: 2 },
  person_count:    { max: 20 }
};

let mqttClient = null;
const wsClients = new Set();

// ─── WebSocket Yayını ────────────────────────────────────────────────────────
function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const ws of wsClients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

function addWsClient(ws) {
  wsClients.add(ws);
  ws.on('close', () => wsClients.delete(ws));
}

// ─── Loglama ─────────────────────────────────────────────────────────────────
function logEvent(event) {
  try {
    const db = getDb();
    db.run(
      `INSERT INTO sensor_logs
        (room_id, event_type, person_count, light_state, ldr_value, sensor1_distance, sensor2_distance, direction, message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.room_id    ?? null,
        event.event_type,
        event.person_count       ?? null,
        event.light_state        ?? null,
        event.ldr_value          ?? null,
        event.sensor1_distance   ?? null,
        event.sensor2_distance   ?? null,
        event.direction          ?? null,
        event.message            ?? null
      ]
    );
  } catch (err) {
    console.error('[MQTT] Log hatası:', err.message);
  }
}

function createAlert(type, severity, message, value, threshold, roomId = null) {
  try {
    const db = getDb();
    db.run(
      `INSERT INTO alerts (room_id, alert_type, severity, message, value, threshold) VALUES (?, ?, ?, ?, ?, ?)`,
      [roomId, type, severity, message, value, threshold]
    );
    broadcast({
      type: 'alert', alert_type: type, severity, message, value, threshold,
      room_id: roomId, timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[MQTT] Alert kayıt hatası:', err.message);
  }
}

// ─── Mod Otomasyonu ──────────────────────────────────────────────────────────
// Sensor verisi geldiğinde, odanın moduna göre ışık kararı verilir.
// Backend merkezi karar verir → ESP32 sadece uygular.
function evaluateRoomAutomation(room, updatedPersonCount, updatedLdrValue) {
  const db = getDb();
  const ldr = updatedLdrValue !== undefined ? updatedLdrValue : (room.current_ldr || globalLdrValue);
  const persons = updatedPersonCount ?? room.person_count;
  const threshold = room.ldr_threshold;

  let desiredState = room.light_state; // varsayılan: değişiklik yok

  // Simülatör ldr = 1 (Karanlık) gönderir. Gerçek ESP32 analog değer (örn: 2500) gönderir.
  // Analog değerlerde threshold'dan büyükse karanlık sayılır (Arduino'daki mantığa uygun).
  const isDark = (ldr === 1) || (ldr > threshold && ldr > 1);

  if (room.light_mode === 'auto') {
    desiredState = isDark ? 1 : 0;

  } else if (room.light_mode === 'half_auto') {
    desiredState = (isDark && persons > 0) ? 1 : 0;
  }
  // 'manual' modda hiçbir şey yapma

  if (desiredState !== room.light_state) {
    const action = desiredState === 1 ? 'LIGHT_ON' : 'LIGHT_OFF';
    const note = room.light_mode === 'auto'
      ? `Otomasyon (auto): Ortam ${isDark ? 'Karanlık' : 'Aydınlık'}`
      : `Otomasyon (half_auto): Ortam ${isDark ? 'Karanlık' : 'Aydınlık'}, kişi=${persons}`;

    console.log(`[AUTO] ${room.name} → ${action} | ${note}`);

    // DB güncelle
    db.run(
      `UPDATE rooms SET light_state = ?, current_ldr = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [desiredState, ldr, room.id]
    );

    // Log yaz
    db.run(
      `INSERT INTO light_control_logs
        (room_id, triggered_by, action, new_light_state, ldr_value, ldr_threshold, person_count, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [room.id, room.light_mode, action, desiredState, ldr, threshold, persons, note]
    );

    // ESP32'ye komut gönder
    publishLightCommand(room.mqtt_cmd_topic, desiredState);
    saveDb();

    // WebSocket üzerinden UI'a bildir
    broadcast({
      type: 'room_update',
      room_id: room.id,
      room_name: room.name,
      light_state: desiredState,
      triggered_by: room.light_mode,
      timestamp: new Date().toISOString()
    });
  } else {
    // Durum değişmedi ama LDR güncellensin
    db.run(
      `UPDATE rooms SET current_ldr = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [ldr, room.id]
    );
  }
}

// ─── MQTT Komut Yayını (Backend → ESP32) ─────────────────────────────────────
function publishLightCommand(cmdTopic, state) {
  if (!mqttClient || !mqttClient.connected) {
    console.warn('[MQTT] Bağlantı yok, komut gönderilemedi:', cmdTopic);
    return;
  }
  const payload = JSON.stringify({ action: "light", state, ts: Date.now() });
  mqttClient.publish(cmdTopic, payload, { qos: 1, retain: true });
  console.log(`[MQTT] → ${cmdTopic} :`, payload);
}

function publishModeCommand(cmdTopic, mode, threshold) {
  if (!mqttClient || !mqttClient.connected) {
    console.warn('[MQTT] Bağlantı yok, mod komutu gönderilemedi:', cmdTopic);
    return;
  }
  const payload = JSON.stringify({ action: "mode", mode, ldr_threshold: threshold, ts: Date.now() });
  mqttClient.publish(cmdTopic, payload, { qos: 1, retain: true });
  console.log(`[MQTT] → ${cmdTopic} :`, payload);
}

// ─── Gelen MQTT Mesajı İşleme ─────────────────────────────────────────────────
function handleSensorMessage(topic, payload) {
  const db = getDb();

  // Global LDR güncellemesi (her sensör mesajında)
  if (payload.ldr_value !== undefined) {
    globalLdrValue = payload.ldr_value;
  }

  // Hangi odaya ait? topic: problem_id / takim_no / mesaj_tipi
  let room = null;
  const match = topic.match(/([^/]+)\/([^/]+)\/(telemetry|command)/);
  if (match) {
    const takim_no = match[2];
    room = db.get("SELECT * FROM rooms WHERE id = ?", [takim_no]);
  }
  if (!room) {
    room = db.get("SELECT * FROM rooms WHERE LOWER(name) = 'salon'");
  }

  if (room) {
    const ldrVal = payload.ldr_value !== undefined ? payload.ldr_value : room.current_ldr;
    const personCount = payload.person_count !== undefined ? payload.person_count : room.person_count;

    // DB güncelle
    db.run(
      `UPDATE rooms SET current_ldr = ?, person_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [ldrVal, personCount, room.id]
    );

    // Eşik uyarıları
    if (payload.person_count !== undefined && payload.person_count > THRESHOLDS.person_count.max) {
      createAlert('overcrowding', 'critical',
        `Kişi sayısı eşiği aştı: ${payload.person_count}`,
        payload.person_count, THRESHOLDS.person_count.max, room.id);
    }
  }

  // Tüm odaların auto/half_auto modlarını yeniden değerlendir
  const activeRooms = db.all("SELECT * FROM rooms WHERE light_mode IN ('auto', 'half_auto')");
  for (const r of activeRooms) {
    const ldrVal = (r.id === room?.id && payload.ldr_value !== undefined) ? payload.ldr_value : (r.current_ldr || globalLdrValue);
    const personCount = (r.id === room?.id && payload.person_count !== undefined) ? payload.person_count : r.person_count;
    evaluateRoomAutomation(r, personCount, ldrVal);
  }
}

// ─── MQTT Bağlantısı ─────────────────────────────────────────────────────────
function connectMqtt() {
  const host = process.env.MQTT_HOST || 'localhost';
  const port = parseInt(process.env.MQTT_PORT) || 1883;

  const options = {
    clientId: `iot_dashboard_${Date.now()}`,
    reconnectPeriod: 5000,
    connectTimeout: 10000
  };

  if (process.env.MQTT_USERNAME) {
    options.username = process.env.MQTT_USERNAME;
    options.password = process.env.MQTT_PASSWORD;
  }

  console.log(`[MQTT] Broker'a bağlanılıyor: mqtt://${host}:${port}`);
  mqttClient = mqtt.connect(`mqtt://${host}:${port}`, options);

  mqttClient.on('connect', () => {
    console.log('[MQTT] Bağlantı kuruldu ✓');

    mqttClient.subscribe('+/+/telemetry', { qos: 1 });
    mqttClient.subscribe('+/+/command', { qos: 1 });

    console.log('[MQTT] Topic\'lere abone olundu (+/+/telemetry ve +/+/command)');
  });

  mqttClient.on('message', (topic, rawMsg) => {
    let payload;
    try { payload = JSON.parse(rawMsg.toString()); }
    catch { payload = { raw: rawMsg.toString() }; }

    console.log(`[MQTT] ← ${topic}:`, payload);

    handleSensorMessage(topic, payload);

    // Event tipini belirle
    let event_type = 'sensor_data';
    if (payload.direction) {
      event_type = payload.direction === 'in'  ? 'entry' :
                   payload.direction === 'out' ? 'exit'  : 'person_update';
    } else if (payload.light_state !== undefined) {
      event_type = 'light_change';
    } else if (payload.status) {
      event_type = 'status';
    }

    // room_id'yi bul
    let room_id = null;
    const match = topic.match(/([^/]+)\/([^/]+)\/(telemetry|command)/);
    const db = getDb();
    if (match) {
      const takim_no = match[2];
      const r = db.get("SELECT id FROM rooms WHERE id = ?", [takim_no]);
      room_id = r?.id ?? null;
    } else {
      const r = db.get("SELECT id FROM rooms WHERE LOWER(name) = 'salon'");
      room_id = r?.id ?? null;
    }

    const eventData = {
      room_id,
      event_type,
      person_count:     payload.person_count,
      light_state:      payload.light_state,
      ldr_value:        payload.ldr_value,
      sensor1_distance: payload.s1,
      sensor2_distance: payload.s2,
      direction:        payload.direction,
      message:          payload.message
    };

    logEvent(eventData);

    broadcast({
      type: 'sensor_update',
      topic,
      ...eventData,
      global_ldr: globalLdrValue,
      timestamp: new Date().toISOString()
    });
  });

  mqttClient.on('error',     (err) => console.error('[MQTT] Hata:', err.message));
  mqttClient.on('reconnect', ()    => console.log('[MQTT] Yeniden bağlanıyor...'));
  mqttClient.on('offline',   ()    => {
    console.warn('[MQTT] Broker bağlantısı kesildi');
    broadcast({ type: 'mqtt_status', connected: false });
  });

  return mqttClient;
}

// ─── Simülatör (Geliştirme/Test Amaçlı) ─────────────────────────────────────
function startSimulator() {
  console.log('[SIM] Simülatör başlatılıyor (MQTT_SIMULATE=true)');
  const db = getDb();
  let personCount = 0;

  // Her 3 saniyede sensor verisi
  setInterval(() => {
    const ldr = Math.floor(Math.random() * 3000 + 200);
    const s1  = Math.random() * 100 + 5;
    const s2  = Math.random() * 100 + 5;
    const room = db.get("SELECT id FROM rooms WHERE LOWER(name) = LOWER('Salon')");
    const takim_no = room ? room.id : 1;

    // Global LDR güncelle ve otomasyon tetikle
    globalLdrValue = ldr;
    const rooms = db.all("SELECT * FROM rooms WHERE light_mode IN ('auto', 'half_auto')");
    for (const room of rooms) evaluateRoomAutomation(room, null);

    broadcast({
      type: 'sensor_update',
      topic: `tarim_isik/${takim_no}/telemetry`,
      room_id: room?.id ?? null,
      event_type: 'sensor_data',
      ldr_value: ldr,
      sensor1_distance: s1,
      sensor2_distance: s2,
      person_count: personCount,
      global_ldr: ldr,
      timestamp: new Date().toISOString()
    });

    logEvent({
      event_type: 'sensor_data',
      ldr_value: ldr,
      sensor1_distance: s1,
      sensor2_distance: s2,
      person_count: personCount
    });
  }, 3000);

  // Her 8 saniyede giriş/çıkış
  setInterval(() => {
    const isEntry = Math.random() > 0.4;
    personCount = isEntry
      ? Math.min(personCount + 1, 10)
      : Math.max(personCount - 1, 0);
    const room = db.get("SELECT id FROM rooms WHERE LOWER(name) = LOWER('Salon')");
    const takim_no = room ? room.id : 1;

    const direction = isEntry ? 'in' : 'out';
    const event_type = isEntry ? 'entry' : 'exit';

    // Kişi değişince oda otomasyonunu tetikle
    const rooms = db.all("SELECT * FROM rooms WHERE light_mode IN ('half_auto')");
    for (const room of rooms) evaluateRoomAutomation(room, personCount);

    broadcast({
      type: 'sensor_update',
      topic: `tarim_isik/${takim_no}/telemetry`,
      room_id: room?.id ?? null,
      event_type,
      person_count: personCount,
      direction,
      global_ldr: globalLdrValue,
      timestamp: new Date().toISOString()
    });

    logEvent({ event_type, person_count: personCount, direction });
    console.log(`[SIM] ${isEntry ? 'Giriş' : 'Çıkış'} → Kişi: ${personCount} | LDR: ${globalLdrValue}`);
  }, 8000);
}

module.exports = { connectMqtt, addWsClient, publishLightCommand, publishModeCommand, startSimulator, broadcast };
