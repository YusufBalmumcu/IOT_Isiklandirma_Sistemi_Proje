# 💡 Akıllı Işıklandırma Sistemi - Web Dashboard

ESP32 tabanlı otonom ışıklandırma sistemi için gerçek zamanlı web kontrol paneli.

## Mimari

```
ESP32 (HC-SR04 + LDR)
    │
    │  MQTT (WiFi üzerinden)
    ▼
Mosquitto MQTT Broker  ←── aynı PC veya Raspberry Pi'da çalışır
    │
    │  mqtt.js
    ▼
Node.js Backend (Express + WebSocket)
    │
    │  REST API + WebSocket
    ▼
React Frontend (Tarayıcı)
```

## Kurulum

### 1. Mosquitto MQTT Broker Kurulumu

**Ubuntu/Debian (Raspberry Pi dahil):**
```bash
sudo apt install mosquitto mosquitto-clients -y
sudo systemctl enable mosquitto
sudo systemctl start mosquitto

# Şifreli kullanım için (opsiyonel)
sudo mosquitto_passwd -c /etc/mosquitto/passwd kullanici_adi
```

**Windows:**
Mosquitto indirin: https://mosquitto.org/download/

**mosquitto.conf (temel):**
```
listener 1883
allow_anonymous true
```

### 2. Backend Kurulumu

```bash
cd backend
npm install

# .env dosyasını düzenleyin:
# MQTT_HOST=localhost  (Mosquitto'nun IP'si)
# JWT_SECRET=cok_gizli_bir_sifre
```

**Test modu (ESP32 olmadan simülatörle çalıştırma):**
```bash
MQTT_SIMULATE=true node server.js
```

**Gerçek ESP32 ile çalıştırma:**
```bash
node server.js
```

### 3. Frontend Kurulumu

```bash
cd frontend
npm install
npm start
# Tarayıcıda http://localhost:3000 açın
```

**Üretim build:**
```bash
npm run build
# build/ klasörü backend tarafından sunulur
```

### 4. ESP32 Firmware

`esp32_firmware/main.ino` dosyasını Arduino IDE ile açın.

**Gerekli kütüphaneler (Library Manager'dan yükleyin):**
- PubSubClient
- ArduinoJson

**Düzenlenecek satırlar:**
```cpp
const char* WIFI_SSID     = "WIFI_ADINIZ";
const char* WIFI_PASSWORD = "WIFI_SIFRENIZ";
const char* MQTT_SERVER   = "192.168.1.100"; // Backend PC'nin IP'si
```

**Pin bağlantıları:**
| ESP32 Pin | Bileşen |
|-----------|---------|
| GPIO 25   | HC-SR04 #1 TRIG |
| GPIO 26   | HC-SR04 #1 ECHO |
| GPIO 27   | HC-SR04 #2 TRIG |
| GPIO 14   | HC-SR04 #2 ECHO |
| GPIO 34   | LDR (analog) |
| GPIO 2    | LED / Röle |

## Giriş Bilgileri

Varsayılan kullanıcı: **admin / admin123**

Yeni kullanıcı oluşturmak için admin yetkisi gerekir:
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"username":"ogretmen","password":"sifre123","role":"viewer"}'
```

## MQTT Topic Yapısı

| Topic | Yön | İçerik |
|-------|-----|--------|
| `esp32/sensors` | ESP32→Backend | LDR, S1, S2 mesafeleri, kişi sayısı |
| `esp32/persons` | ESP32→Backend | Giriş/çıkış olayları |
| `esp32/light` | ESP32→Backend | Işık açık/kapalı olayları |
| `esp32/status` | ESP32→Backend | Cihaz bağlantı durumu |

### Örnek MQTT Mesajları

**esp32/persons:**
```json
{"person_count": 3, "direction": "in", "event": "entry"}
```

**esp32/sensors:**
```json
{"s1": 23.4, "s2": 87.1, "ldr_value": 1240, "light_state": 1, "person_count": 2}
```

**esp32/light:**
```json
{"light_state": 1, "ldr_value": 1100, "person_count": 1, "reason": "persons_detected"}
```

## Uyarı Eşikleri (backend/mqttService.js)

```js
const THRESHOLDS = {
  ldr: { max: 4000, min: 50 },
  sensor_distance: { max: 400, min: 2 },
  person_count: { max: 20 }
};
```

## Test - MQTT Simülasyonu (ESP32 olmadan)

```bash
# Backend'i simülatör modunda çalıştır
cd backend
MQTT_SIMULATE=true node server.js

# veya Mosquitto kullanarak manuel test:
mosquitto_pub -t esp32/persons -m '{"person_count":2,"direction":"in","event":"entry"}'
mosquitto_pub -t esp32/light   -m '{"light_state":1,"ldr_value":800,"person_count":2}'
mosquitto_pub -t esp32/sensors -m '{"s1":30.5,"s2":12.3,"ldr_value":900,"light_state":1,"person_count":2}'
```

## Tek Komutla Tüm Sistemi Başlatma (Launcher)

Tüm servisleri farklı pencerelerden başlatmak yerine, root dizinindeki `start.js` scripti ile her şeyi tek bir terminalden çalıştırabilirsiniz:

```bash
node start.js
```

Bu script:
1. `backend`, `simulator` ve `frontend` klasörlerinde `node_modules` klasörü yoksa otomatik olarak `npm install` çalıştırır.
2. `flutter devices` komutuyla bağlı bir mobil test cihazı veya emülatör olup olmadığını denetler.
3. Backend (port 3001), Simülatör (MQTT sensör simülasyonu) ve Web Dashboard (React Frontend) bileşenlerini sırasıyla ayağa kaldırır.
4. Cihaz bağlıysa Mobil Uygulamayı (`flutter run`) da başlatır ve terminal üzerinden hot-reload komutlarını (örneğin `r` tuşu) Flutter sürecine yönlendirir.
5. `Ctrl + C` basıldığında Windows/Unix fark etmeksizin tüm süreç ağaçlarını kökten sonlandırarak port kilitlenmelerini engeller.
