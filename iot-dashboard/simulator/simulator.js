/*
 * ESP32 MQTT Simülatörü
 * Gerçek bir ESP32 gibi davranarak MQTT broker'a veri gönderir.
 *
 * Kurulum:
 *   cd simulator
 *   npm install
 *   node simulator.js
 *
 * Gereksinim: Mosquitto broker çalışıyor olmalı (localhost:1883)
 */

const mqtt = require('mqtt');

// ========================
// YAPILANDIRMA
// ========================
const MQTT_HOST = process.env.MQTT_HOST || 'broker.emqx.io';
const MQTT_PORT = parseInt(process.env.MQTT_PORT) || 1883;
const TOPIC_PREFIX = process.env.MQTT_TOPIC_PREFIX || 'iot_dash_abird_';
const SENSOR_INTERVAL_MS  = 3000;  // Sensör verisi yayın sıklığı
const PERSON_INTERVAL_MS  = 6000;  // Giriş/çıkış olayı sıklığı
const LIGHT_CHECK_MS      = 1000;  // Işık durum kontrolü

// ========================
// DURUM
// ========================
let personCount = 0;
let lightOn     = false;
let lastLdr     = 1500;

// Gerçekçi LDR simülasyonu — 0 (Aydınlık) veya 1 (Karanlık)
function nextLdr() {
  lastLdr = Math.random() < 0.5 ? 0 : 1;
  return lastLdr;
}

// Gerçekçi ultrasonik mesafe — kapı geçişlerinde kısa süre düşer
function nextDistance(triggered) {
  if (triggered) return +(Math.random() * 30 + 5).toFixed(1);
  return +(Math.random() * 150 + 60).toFixed(1);
}

// ========================
// MQTT BAĞLANTI
// ========================
console.log(`[SIM] MQTT broker'a bağlanılıyor: mqtt://${MQTT_HOST}:${MQTT_PORT}`);

const client = mqtt.connect(`mqtt://${MQTT_HOST}:${MQTT_PORT}`, {
  clientId: `esp32_simulator_${Date.now()}`,
  reconnectPeriod: 3000,
  connectTimeout: 8000,
  clean: true
});

client.on('connect', () => {
  console.log('[SIM] ✓ Bağlantı kuruldu\n');

  // Başlangıç durumu
  publish(TOPIC_PREFIX + 'esp32/status', {
    status: 'online',
    ip: '192.168.1.99',
    version: 'sim-1.0',
    message: 'ESP32 Simülatörü başlatıldı'
  }, true);

  startSensorLoop();
  startPersonLoop();
  startLightLoop();
});

client.on('error', err => console.error('[SIM] MQTT Hata:', err.message));
client.on('reconnect', () => console.log('[SIM] Yeniden bağlanılıyor...'));
client.on('offline', () => console.warn('[SIM] Broker bağlantısı kesildi'));

function publish(topic, payload, retain = false) {
  const msg = JSON.stringify(payload);
  client.publish(topic, msg, { qos: 1, retain }, (err) => {
    if (err) console.error(`[SIM] Yayın hatası (${topic}):`, err.message);
    else console.log(`[SIM] ↑ ${topic}:`, payload);
  });
}

// ========================
// DÖNGÜLER
// ========================

function startSensorLoop() {
  setInterval(() => {
    const ldr = nextLdr();
    const s1  = nextDistance(false);
    const s2  = nextDistance(false);

    publish(TOPIC_PREFIX + 'esp32/sensors', {
      s1,
      s2,
      ldr_value:    ldr,
      light_state:  lightOn ? 1 : 0,
      person_count: personCount
    });
  }, SENSOR_INTERVAL_MS);
}

function startPersonLoop() {
  setInterval(() => {
    // %60 giriş, %40 çıkış olasılığı
    const isEntry = Math.random() < 0.6;

    if (isEntry) {
      personCount = Math.min(personCount + 1, 10);
    } else {
      if (personCount === 0) return; // Oda boşsa çıkış olmaz
      personCount = Math.max(personCount - 1, 0);
    }

    const direction = isEntry ? 'in' : 'out';

    // Gerçekçilik: giriş/çıkışta sensörler kısa süre tetiklenir
    const s1Triggered = isEntry;  // İç sensör önce tetiklenir (giriş)
    const s2Triggered = !isEntry; // Dış sensör önce tetiklenir (çıkış)

    publish(TOPIC_PREFIX + 'esp32/persons', {
      person_count: personCount,
      direction,
      event:        isEntry ? 'entry' : 'exit',
      s1:           nextDistance(s1Triggered),
      s2:           nextDistance(s2Triggered)
    });

    console.log(`\n[SIM] 👤 ${isEntry ? '→ GİRİŞ' : '← ÇIKIŞ'} | Oda: ${personCount} kişi\n`);
  }, PERSON_INTERVAL_MS + Math.random() * 2000); // Biraz rastgele aralık
}

function startLightLoop() {
  setInterval(() => {
    const ldr = lastLdr;
    const shouldBeOn = personCount > 0 && ldr === 1;

    if (shouldBeOn !== lightOn) {
      lightOn = shouldBeOn;

      publish(TOPIC_PREFIX + 'esp32/light', {
        light_state:  lightOn ? 1 : 0,
        ldr_value:    ldr,
        person_count: personCount,
        reason: lightOn
          ? 'persons_detected_dark'
          : (personCount === 0 ? 'room_empty' : 'sufficient_light')
      }, true); // retain=true: broker son değeri saklar

      console.log(`\n[SIM] 💡 IŞIK ${lightOn ? 'AÇILDI' : 'KAPANDI'} (LDR: ${ldr === 1 ? 'Karanlık' : 'Aydınlık'}, Kişi: ${personCount})\n`);
    }
  }, LIGHT_CHECK_MS);
}

// Temiz kapatma
process.on('SIGINT', () => {
  console.log('\n[SIM] Kapatılıyor...');
  publish(TOPIC_PREFIX + 'esp32/status', { status: 'offline' }, true);
  setTimeout(() => { client.end(); process.exit(0); }, 500);
});
