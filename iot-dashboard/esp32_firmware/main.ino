/*
 * ESP32 - Akıllı Işıklandırma Sistemi v2.0
 * Oda Bazlı MQTT Pub/Sub
 *
 * Kütüphane gereksinimleri (Arduino Library Manager):
 *   - PubSubClient (Nick O'Leary)
 *   - ArduinoJson  (Benoit Blanchon)
 *
 * ── PUBLISH (ESP32 → Backend) ──────────────────────────────────────
 *   iot_dash_abird_room/salon/sensors  → LDR + ultrasonik (3 sn)
 *   iot_dash_abird_room/salon/persons  → Giriş/çıkış olayı
 *   iot_dash_abird_room/salon/light    → Işık durum değişimi
 *   iot_dash_abird_room/salon/status   → Bağlantı durumu
 *
 * ── SUBSCRIBE (Backend → ESP32) ────────────────────────────────────
 *   iot_dash_abird_cmd/salon/light     → {"state": 1|0}
 *   iot_dash_abird_cmd/salon/mode      → {"mode": "auto", "ldr_threshold": 1500}
 *
 * NOT: Mod kararı backend tarafından verilir.
 *      ESP32 sadece backend'in "light" komutunu uygular.
 *      Bu yaklaşım merkezi log ve kontrol sağlar.
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <WiFiUdp.h>

// ========================
// YAPILANDIRMA - DEĞİŞTİR
// ========================
const char* WIFI_SSID      = "WIFI_ADINIZ";
const char* WIFI_PASSWORD  = "WIFI_SIFRENIZ";
const char* MQTT_SERVER    = "10.199.81.131";  // Varsayılan/Yedek IP
const int   MQTT_PORT      = 1883;
const char* MQTT_USER      = "";               // Boş bırakılabilir
const char* MQTT_PASS      = "";

// Dinamik IP takibi için değişkenler
String currentMqttServer   = MQTT_SERVER;
int connectionFailures     = 0;

// Oda adı — topic'lerde kullanılır (küçük harf, boşluksuz)
const char* ROOM_NAME      = "salon";

// ========================
// PIN TANIMLAMALARI
// ========================
const int TRIG1   = 25, ECHO1 = 26;   // HC-SR04 #1 — İç taraf
const int TRIG2   = 27, ECHO2 = 14;   // HC-SR04 #2 — Dış taraf
const int LDR_PIN = 34;               // ADC — Ortam ışığı (global)
const int RELAY_PIN = 2;              // Röle / LED çıkışı (HIGH = AÇIK)

// ========================
// PARAMETRELER
// ========================
const float  DETECT_CM           = 45.0;   // Kişi algılama eşiği (cm)
const unsigned long SENSOR_MS    = 3000;   // Periyodik sensör yayım aralığı
const unsigned long SENSOR_TIMEOUT_MS = 500; // İki HC-SR04 arası max bekleme

// ========================
// TOPIC TAMPONLARI
// ========================
char topicSensors[64], topicPersons[64], topicLight[64];
char topicStatus[64],  topicCmdLight[64], topicCmdMode[64];

// ========================
// DURUM DEĞİŞKENLERİ
// ========================
int  kisiSayisi   = 0;
bool lightOn      = false;  // Mevcut ışık durumu (ESP32'nin bildiği)
int  lastLdr      = 0;

bool s1Trig = false, s2Trig = false;
unsigned long s1Time = 0, s2Time = 0;

WiFiClient   espClient;
PubSubClient mqtt(espClient);
unsigned long lastSensorPublish = 0;

// ========================
// YARDIMCI FONKSİYONLAR
// ========================

float readDistance(int trig, int echo) {
  digitalWrite(trig, LOW);  delayMicroseconds(2);
  digitalWrite(trig, HIGH); delayMicroseconds(10);
  digitalWrite(trig, LOW);
  long dur = pulseIn(echo, HIGH, 30000);
  if (dur == 0) return 999.0;
  float d = dur * 0.0343 / 2.0;
  return (d < 2.0 || d > 400.0) ? 999.0 : d;
}

void publishJson(const char* topic, JsonDocument& doc, bool retain = false) {
  char buf[300];
  serializeJson(doc, buf);
  mqtt.publish(topic, buf, retain);
}

// Işığı doğrudan uygula (backend kararını execute et)
void applyLight(int state, const char* reason = "cmd") {
  if ((state == 1) == lightOn) return; // Zaten o durumda

  lightOn = (state == 1);
  digitalWrite(RELAY_PIN, lightOn ? HIGH : LOW);

  // Işık durumunu backend'e bildir
  StaticJsonDocument<128> doc;
  doc["light_state"]  = lightOn ? 1 : 0;
  doc["ldr_value"]    = lastLdr;
  doc["person_count"] = kisiSayisi;
  doc["reason"]       = reason;
  publishJson(topicLight, doc, true);

  Serial.printf("[IŞIK] %s | Sebep: %s | LDR:%d Kişi:%d\n",
                lightOn ? "AÇIK" : "KAPALI", reason, lastLdr, kisiSayisi);
}

// Kişi giriş/çıkış olayı
void handlePersonEvent(bool isEntry) {
  if (isEntry) { kisiSayisi++; }
  else          { kisiSayisi = max(0, kisiSayisi - 1); }

  StaticJsonDocument<128> doc;
  doc["person_count"] = kisiSayisi;
  doc["direction"]    = isEntry ? "in" : "out";
  doc["room"]         = ROOM_NAME;
  publishJson(topicPersons, doc);

  Serial.printf("[KİŞİ] %s → Toplam: %d\n", isEntry ? "Giriş" : "Çıkış", kisiSayisi);
}

// ========================
// MQTT KOMUT ALIMI
// Backend'den gelen komutları işle
// ========================
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  char msg[256] = {0};
  memcpy(msg, payload, min((unsigned int)255, length));

  Serial.printf("[MQTT] ← %s : %s\n", topic, msg);

  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, msg) != DeserializationError::Ok) return;

  // Işık komutu: {"state": 0|1}
  if (strcmp(topic, topicCmdLight) == 0) {
    int state = doc["state"] | -1;
    if (state == 0 || state == 1) {
      applyLight(state, "backend_cmd");
    }
  }

  // Mod komutu: {"mode": "auto", "ldr_threshold": 1500}
  // ESP32 bu bilgiyi sadece loglar — mod kararı backend verir
  else if (strcmp(topic, topicCmdMode) == 0) {
    const char* mode = doc["mode"] | "manual";
    int thr = doc["ldr_threshold"] | 1500;
    Serial.printf("[MOD] Yeni mod: %s | Eşik: %d\n", mode, thr);
    // İleride ESP32 bağımsız çalışması gerekirse buraya mod mantığı eklenebilir
  }
}

// ========================
// WiFi & MQTT BAĞLANTISI
// ========================

void buildTopics() {
  snprintf(topicSensors,  64, "iot_dash_abird_room/%s/sensors", ROOM_NAME);
  snprintf(topicPersons,  64, "iot_dash_abird_room/%s/persons", ROOM_NAME);
  snprintf(topicLight,    64, "iot_dash_abird_room/%s/light",   ROOM_NAME);
  snprintf(topicStatus,   64, "iot_dash_abird_room/%s/status",  ROOM_NAME);
  snprintf(topicCmdLight, 64, "iot_dash_abird_cmd/%s/light",    ROOM_NAME);
  snprintf(topicCmdMode,  64, "iot_dash_abird_cmd/%s/mode",     ROOM_NAME);
}

void connectWifi() {
  Serial.printf("[WiFi] Bağlanılıyor: %s\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.printf("\n[WiFi] Bağlandı — IP: %s\n", WiFi.localIP().toString().c_str());
}

void discoverMqttServer() {
  WiFiUDP udp;
  udp.begin(4545);
  Serial.println("[Discovery] UDP üzerinden MQTT sunucusu aranıyor...");
  unsigned long startTime = millis();
  while (millis() - startTime < 10000) { // En fazla 10 saniye bekle
    int packetSize = udp.parsePacket();
    if (packetSize) {
      char buffer[256];
      int len = udp.read(buffer, 255);
      if (len > 0) buffer[len] = 0;

      StaticJsonDocument<256> doc;
      if (deserializeJson(doc, buffer) == DeserializationError::Ok) {
        if (strcmp(doc["service"] | "", "iot-dashboard-backend") == 0) {
          const char* ip = doc["ips"][0]; // İlk IP adresini al
          if (ip) {
            currentMqttServer = String(ip);
            Serial.printf("[Discovery] MQTT Sunucusu bulundu: %s\n", currentMqttServer.c_str());
            mqtt.setServer(currentMqttServer.c_str(), MQTT_PORT);
            udp.stop();
            return;
          }
        }
      }
    }
    delay(100);
  }
  udp.stop();
  Serial.println("[Discovery] Sunucu bulunamadı, mevcut/varsayılan IP kullanılacak.");
}

void connectMqtt() {
  while (!mqtt.connected()) {
    // 3 defa bağlantı hatası alınırsa sunucuyu UDP ile tekrar ara
    if (connectionFailures >= 3) {
      discoverMqttServer();
      connectionFailures = 0;
    }

    String clientId = String("ESP32_") + ROOM_NAME + "_" + String(random(9999));
    Serial.printf("[MQTT] Bağlanılıyor (%s) -> %s:%d...\n", clientId.c_str(), currentMqttServer.c_str(), MQTT_PORT);

    bool ok = (strlen(MQTT_USER) > 0)
        ? mqtt.connect(clientId.c_str(), MQTT_USER, MQTT_PASS)
        : mqtt.connect(clientId.c_str());

    if (ok) {
      Serial.println("[MQTT] Bağlandı ✓");
      connectionFailures = 0;

      // Komut topic'lerine abone ol
      mqtt.subscribe(topicCmdLight, 1);
      mqtt.subscribe(topicCmdMode,  1);
      Serial.printf("[MQTT] Abone: %s, %s\n", topicCmdLight, topicCmdMode);

      // Online durumu yayınla (retain: true — backend yeniden başlayınca görsün)
      StaticJsonDocument<128> doc;
      doc["status"] = "online";
      doc["ip"]     = WiFi.localIP().toString();
      doc["room"]   = ROOM_NAME;
      doc["version"] = "2.0";
      publishJson(topicStatus, doc, true);

    } else {
      Serial.printf("[MQTT] Hata: %d — 5s sonra tekrar...\n", mqtt.state());
      connectionFailures++;
      delay(5000);
    }
  }
}

// ========================
// SETUP & LOOP
// ========================

void setup() {
  Serial.begin(115200);
  delay(500);

  // Pin ayarları
  pinMode(TRIG1, OUTPUT); pinMode(ECHO1, INPUT);
  pinMode(TRIG2, OUTPUT); pinMode(ECHO2, INPUT);
  pinMode(LDR_PIN, INPUT);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);

  buildTopics();
  connectWifi();
  
  // Başlangıçta UDP keşfi yap
  discoverMqttServer();
  
  mqtt.setCallback(mqttCallback);
  connectMqtt();

  Serial.println("\n[SYS] Başlatıldı ✓");
  Serial.printf("  Oda    : %s\n", ROOM_NAME);
  Serial.printf("  Pub    : %s\n", topicSensors);
  Serial.printf("  Sub    : %s\n", topicCmdLight);
}

void loop() {
  // MQTT bağlantısını koru
  if (!mqtt.connected()) connectMqtt();
  mqtt.loop();

  unsigned long now = millis();

  // ── Sensör okumaları ──────────────────────────────────────────────
  float d1  = readDistance(TRIG1, ECHO1);
  float d2  = readDistance(TRIG2, ECHO2);
  int   ldr = digitalRead(LDR_PIN); // 3-pinli dijital LDR okuma (1: Karanlık, 0: Aydınlık)
  lastLdr   = ldr;

  // ── Kişi sayım algoritması (yön tespitli çift HC-SR04) ───────────
  bool s1Active = (d1 < DETECT_CM);
  bool s2Active = (d2 < DETECT_CM);

  if (s1Active && !s1Trig) { s1Trig = true; s1Time = now; }
  if (s2Active && !s2Trig) { s2Trig = true; s2Time = now; }

  if (s1Trig && s2Trig) {
    if (abs((long)(s1Time - s2Time)) < (long)SENSOR_TIMEOUT_MS) {
      // S1 iç taraf, S2 dış taraf:
      //   S1 önce → içeriden dışarıya → ÇIKIŞ
      //   S2 önce → dışarıdan içeriye → GİRİŞ
      bool isEntry = (s2Time < s1Time);
      handlePersonEvent(isEntry);
    }
    s1Trig = s2Trig = false;
  }

  // Timeout: tek sensör tetiklendiyse sıfırla
  if (s1Trig && (now - s1Time > SENSOR_TIMEOUT_MS)) s1Trig = false;
  if (s2Trig && (now - s2Time > SENSOR_TIMEOUT_MS)) s2Trig = false;

  // ── Periyodik sensör yayını (3 saniyede bir) ──────────────────────
  if (now - lastSensorPublish >= SENSOR_MS) {
    lastSensorPublish = now;

    StaticJsonDocument<200> doc;
    doc["s1"]           = d1;
    doc["s2"]           = d2;
    doc["ldr_value"]    = ldr;
    doc["light_state"]  = lightOn ? 1 : 0;
    doc["person_count"] = kisiSayisi;
    doc["room"]         = ROOM_NAME;
    publishJson(topicSensors, doc);

    Serial.printf("[SENSÖR] S1:%.1fcm S2:%.1fcm LDR:%d Kişi:%d Işık:%s\n",
                  d1, d2, ldr, kisiSayisi, lightOn ? "AÇIK" : "KAPALI");
  }

  delay(50); // ~20Hz döngü hızı
}
