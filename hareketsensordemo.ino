#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ILI9341.h>
#include <XPT2046_Touchscreen.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include <WiFi.h>
#include <PubSubClient.h>

// --- WIFI & MQTT AYARLARI ---
const char* ssid     = "TurkTelekom_TPADE4_2.4GHz";
const char* password = "pVdqbpFcHF7k";
const char* mqtt_server = "192.168.1.125";

WiFiClient espClient;
PubSubClient client(espClient);
unsigned long lastMqttUpdate = 0;
unsigned long sensorCooldown = 0; // Hareket sensörü cooldown süresi

// --- PIN TANIMLARI ---
#define TFT_CS   5
#define TFT_DC   17
#define TFT_RST  16
#define TS_CS    4
const int trigPinR = 27, echoPinR = 14, trigPinL = 26, echoPinL = 25;
const int ldrPin = 34, akilliIsik = 32;

Adafruit_ILI9341 tft = Adafruit_ILI9341(TFT_CS, TFT_DC, TFT_RST);
XPT2046_Touchscreen ts(TS_CS);

// --- DEĞİŞKENLER ---
int currentPage = 1;
int kisiSayisi = 0;
bool btTakipModu = false;
String takipAdresi = "";
int rssiDegeri = -100;
bool kullaniciYakin = false;

// Bluetooth Nesneleri
int scanTime = 2; 
BLEScan* pBLEScan;
struct BluetoothDevice { String name; String address; };
BluetoothDevice foundDevices[15];
int deviceCount = 0, scrollOffset = 0;
bool isScanning = false;

const int mesafeEsigi = 45, karanlikLimit = 2500;
unsigned long tL = 0, tR = 0, msgTimer = 0, now;
bool sonL = false, sonR = false;
int sonIsik = -1;
bool msgActive = false;

// Renkler
#define C_DARK_GREY 0x2104
#define C_BLUE_GREY 0x528A
#define C_BG        0x0000
#define C_ACCENT    0x1CB1

// --- MQTT TOPIC AYARLARI ---
const char* topic_telemetry = "tarim_isik/1/telemetry";
const char* topic_cmd       = "tarim_isik/1/command";

// --- MQTT BAGLANTI FONKSIYONU ---
void callback(char* topic, byte* payload, unsigned int length) {
    String msg;
    for (int i = 0; i < length; i++) msg += (char)payload[i];
    Serial.print("Gelen MQTT ("); Serial.print(topic); Serial.print("): "); Serial.println(msg);

    // Eğer backend'den komut geldiyse uygula
    if (String(topic).endsWith("/command")) {
        if (msg.indexOf("\"state\":1") > 0 || msg.indexOf("\"state\": 1") > 0) {
            digitalWrite(akilliIsik, HIGH);
        } else if (msg.indexOf("\"state\":0") > 0 || msg.indexOf("\"state\": 0") > 0) {
            digitalWrite(akilliIsik, LOW);
        }
    }
}

void reconnect() {
    while (!client.connected()) {
        Serial.print("MQTT Baglantisi kuruluyor...");
        if (client.connect("ESP32_Akilli_Sistem")) {
            Serial.println("Baglandi.");
            client.subscribe(topic_cmd); // Komutları dinle
            client.publish(topic_telemetry, "{\"status\":\"online\"}");
        } else {
            Serial.print("Hata: "); Serial.print(client.state());
            delay(5000);
        }
    }
}

// --- BLUETOOTH CALLBACK ---
class MyCallbacks: public BLEAdvertisedDeviceCallbacks {
    void onResult(BLEAdvertisedDevice dev) {
        String addr = String(dev.getAddress().toString().c_str());
        if (deviceCount < 15 && !btTakipModu) {
            bool exists = false;
            for(int i=0; i<deviceCount; i++) if(foundDevices[i].address == addr) exists = true;
            if(!exists) {
                foundDevices[deviceCount].name = dev.getName().length() > 0 ? dev.getName().c_str() : "Bilinmeyen";
                foundDevices[deviceCount].address = addr;
                deviceCount++;
            }
        }
        if (btTakipModu && addr == takipAdresi) rssiDegeri = dev.getRSSI();
    }
};

// --- EKRAN FONKSİYONLARI ---
void drawHeader() {
    tft.fillRect(0, 0, 320, 45, C_DARK_GREY);
    tft.drawFastHLine(0, 45, 320, ILI9341_WHITE);
    tft.setTextSize(1); tft.setTextColor(ILI9341_WHITE);
    tft.setCursor(10, 18);
    if(currentPage == 1) tft.print("MONITOR");
    else if(currentPage == 2) tft.print("SCANNER");
    else tft.print("TAKIP");
    tft.drawRoundRect(100, 7, 35, 30, 4, ILI9341_WHITE); 
    tft.setCursor(113, 15); tft.setTextSize(2); tft.print("<");
    tft.setCursor(145, 15); tft.setTextSize(2);
    tft.print(currentPage); tft.print("/3");
    tft.drawRoundRect(190, 7, 35, 30, 4, ILI9341_WHITE);
    tft.setCursor(203, 15); tft.setTextSize(2); tft.print(">");
    if(currentPage == 2) {
        tft.fillRoundRect(240, 7, 75, 30, 4, isScanning ? ILI9341_ORANGE : C_ACCENT);
        tft.setTextSize(1); tft.setCursor(255, 17);
        tft.print(isScanning ? "..." : "TARAMA");
    }
}

void drawPage1() {
    tft.fillRect(0, 46, 320, 194, C_BG);
    tft.drawRoundRect(10, 60, 145, 70, 8, C_BLUE_GREY); 
    tft.drawRoundRect(165, 60, 145, 70, 8, C_BLUE_GREY); 
    tft.drawRoundRect(10, 140, 300, 40, 8, C_BLUE_GREY); 
    tft.setTextSize(1); tft.setTextColor(ILI9341_LIGHTGREY);
    tft.setCursor(20, 70); tft.print("SOL SENSOR");
    tft.setCursor(175, 70); tft.print("SAG SENSOR");
    tft.setCursor(20, 153); tft.print("ORTAM ISIK");
}

void drawPage3() {
    tft.fillRect(0, 46, 320, 194, C_BG);
    tft.setTextSize(2); tft.setTextColor(ILI9341_WHITE);
    tft.setCursor(20, 60); tft.print("ODA KISI: "); tft.print(kisiSayisi);
    tft.setCursor(20, 100); tft.print("BT: ");
    tft.print(takipAdresi == "" ? "SECILMEDI" : (rssiDegeri > -75 ? "YAKIN" : "UZAK"));
    tft.fillRoundRect(20, 160, 280, 50, 10, btTakipModu ? ILI9341_GREEN : ILI9341_MAROON);
    tft.setCursor(55, 177); tft.print(btTakipModu ? "TAKIP AKTIF" : "SENSORA GEC");
}

void drawBTList() {
    tft.fillRect(0, 46, 320, 194, C_BG);
    if (deviceCount == 0 && !isScanning) {
        tft.setTextSize(1); tft.setTextColor(C_BLUE_GREY);
        tft.setCursor(80, 120); tft.print("Cihaz bulunamadi..."); return;
    }
    for (int i = 0; i < deviceCount; i++) {
        int yPos = 55 + (i * 35) - scrollOffset;
        if (yPos > 40 && yPos < 230) {
            tft.setTextSize(1); tft.setTextColor(ILI9341_WHITE); tft.setCursor(20, yPos); tft.print(foundDevices[i].name);
            tft.setTextColor(C_BLUE_GREY); tft.setCursor(20, yPos + 12); tft.print(foundDevices[i].address);
            tft.drawFastHLine(15, yPos + 28, 270, 0x1082);
        }
    }
}

long getDist(int trig, int echo) {
    digitalWrite(trig, LOW); delayMicroseconds(2);
    digitalWrite(trig, HIGH); delayMicroseconds(10);
    digitalWrite(trig, LOW);
    long d = pulseIn(echo, HIGH, 4000);
    return (d <= 0) ? 999 : (d * 0.034 / 2);
}

void setup() {
    Serial.begin(115200);
    pinMode(trigPinL, OUTPUT); pinMode(echoPinL, INPUT);
    pinMode(trigPinR, OUTPUT); pinMode(echoPinR, INPUT);
    pinMode(ldrPin, INPUT); pinMode(akilliIsik, OUTPUT);

    tft.begin(); tft.setRotation(1);
    ts.begin(); ts.setRotation(1);

    // EKRANI HEMEN AÇ (Wi-Fi'dan önce)
    drawHeader(); drawPage1();

    // WiFi Başlat ama bekleme!
    WiFi.begin(ssid, password);
    Serial.println("WiFi baglantisi arka planda baslatildi...");

    client.setServer(mqtt_server, 1883);
    client.setCallback(callback);

    BLEDevice::init("ESP32_AKILLI_SYSTEM");
    pBLEScan = BLEDevice::getScan();
    pBLEScan->setAdvertisedDeviceCallbacks(new MyCallbacks());
    pBLEScan->setActiveScan(true);
}

void loop() {
    now = millis();

    // --- 1. WIFI & MQTT KONTROLÜ (Non-Blocking) ---
    if (WiFi.status() == WL_CONNECTED) {
        if (!client.connected()) {
            static unsigned long lastReconnectAttempt = 0;
            if (now - lastReconnectAttempt > 5000) { // Bağlantı yoksa 5 saniyede bir dene
                lastReconnectAttempt = now;
                if (client.connect("ESP32_Akilli_Sistem")) {
                    client.subscribe(topic_cmd);
                    client.publish(topic_telemetry, "{\"status\":\"online\"}");
                }
            }
        } else {
            client.loop(); // Sadece bağlıyken MQTT trafiğini yönet
        }
    }

    // --- 2. DOKUNMATIK EKRAN KONTROLÜ ---
    if (ts.touched()) {
        TS_Point p = ts.getPoint();
        int x = map(p.x, 200, 3700, 0, 320); 
        int y = map(p.y, 240, 3800, 0, 240);
        
        if (y < 45) { // Header Alanı
            if (x >= 100 && x <= 135) { // Geri Butonu
                currentPage = (currentPage == 1) ? 3 : currentPage - 1;
                drawHeader(); if(currentPage==1) drawPage1(); else if(currentPage==2) drawBTList(); else drawPage3();
                delay(200);
            }
            else if (x >= 190 && x <= 225) { // İleri Butonu
                currentPage = (currentPage == 3) ? 1 : currentPage + 1;
                drawHeader(); if(currentPage==1) drawPage1(); else if(currentPage==2) drawBTList(); else drawPage3();
                delay(200);
            }
            else if (x > 240 && currentPage == 2 && !isScanning) { // Tarama Butonu
                isScanning = true; drawHeader(); deviceCount = 0;
                pBLEScan->start(scanTime, false); 
                isScanning = false;
                drawHeader(); drawBTList();
            }
        } else if (currentPage == 2) { // BT Listesi Seçimi
            int clickedIdx = (y - 55 + scrollOffset) / 35;
            if (clickedIdx >= 0 && clickedIdx < deviceCount) {
                takipAdresi = foundDevices[clickedIdx].address;
                currentPage = 3; drawHeader(); drawPage3();
            }
        } else if (currentPage == 3 && y > 160) { // Takip Modu Butonu
            btTakipModu = !btTakipModu; 
            drawPage3(); 
            delay(300);
        }
    }

    // --- 3. SENSÖR OKUMA VE MANTIKSEL İŞLEMLER ---
    if (!isScanning && now > sensorCooldown) { 
        long dL = getDist(trigPinL, echoPinL); delay(5);
        long dR = getDist(trigPinR, echoPinR);
        bool curL = (dL < mesafeEsigi), curR = (dR < mesafeEsigi);
        int curLdr = analogRead(ldrPin);

        // Sayfa 1 Görsel Güncelleme
        if (currentPage == 1) {
            if (curL != sonL) { 
                tft.fillRect(25, 95, 100, 20, C_BG); tft.setCursor(25, 95); tft.setTextSize(2); 
                tft.setTextColor(curL ? ILI9341_RED : ILI9341_GREEN); tft.print(curL ? "DOLU" : "BOS"); 
                sonL = curL; 
            }
            if (curR != sonR) { 
                tft.fillRect(180, 95, 100, 20, C_BG); tft.setCursor(180, 95); tft.setTextSize(2); 
                tft.setTextColor(curR ? ILI9341_RED : ILI9341_GREEN); tft.print(curR ? "DOLU" : "BOS"); 
                sonR = curR; 
            }
            if (abs(curLdr - sonIsik) > 150) { 
                tft.fillRect(165, 153, 130, 20, C_BG); tft.setCursor(165, 153); tft.setTextSize(2); 
                tft.setTextColor(curLdr < karanlikLimit ? ILI9341_YELLOW : C_BLUE_GREY); 
                tft.print(curLdr < karanlikLimit ? "VAR" : "YOK"); 
                sonIsik = curLdr; 
            }
        }

        // Giriş - Çıkış Algoritması
        if (curL && tL == 0) tL = now;
        if (curR && tR == 0) tR = now;

        if (tL > 0 && tR > 0) {
            String dir = "";
            if (tL < tR) { // Giriş
                kisiSayisi++; 
                dir = "in";
            } else { // Çıkış
                if(kisiSayisi > 0) kisiSayisi--; 
                dir = "out";
            }
            
            if(client.connected()) {
                String payload = "{\"person_count\":" + String(kisiSayisi) + ",\"direction\":\"" + dir + "\"}";
                client.publish(topic_telemetry, payload.c_str());
            }

            // Hoşgeldin/Güle Güle Mesajı
            if (currentPage == 1) {
                tft.fillRoundRect(20, 190, 280, 45, 12, (tL < tR ? 0x03E0 : 0xA800));
                tft.setTextColor(ILI9341_WHITE); tft.setTextSize(2);
                tft.setCursor((tL < tR ? 85 : 105), 205); tft.print(tL < tR ? "HOS GELDINIZ" : "GULE GULE");
                msgActive = true;
            }
            if (currentPage == 3) drawPage3();

            tL = 0; tR = 0; 
            msgTimer = now + 2000;
            sensorCooldown = now + 1000; 
        }
        
        // Periyodik MQTT Güncellemesi (Bağlantı varsa)
        if (client.connected() && (now - lastMqttUpdate > 5000)) {
            String payload = "{\"ldr_value\":" + String(curLdr) + ",\"person_count\":" + String(kisiSayisi) + "}";
            client.publish(topic_telemetry, payload.c_str());

            if (btTakipModu) {
                String btPayload = "{\"rssi\":" + String(rssiDegeri) + ",\"durum\":\"" + (kullaniciYakin ? "YAKIN" : "UZAK") + "\"}";
                client.publish(topic_telemetry, btPayload.c_str());
            }
            lastMqttUpdate = now;
        }

        // Bluetooth Takip Kontrolü
        if (btTakipModu && (now % 4000 < 200)) {
            pBLEScan->start(1, false);
            kullaniciYakin = (rssiDegeri > -75);
            if(currentPage == 3) drawPage3();
        }

        // Akıllı Işık Mantığı (Sadece internet yoksa lokal olarak çalışır)
        if (!client.connected()) {
            if (btTakipModu) {
                digitalWrite(akilliIsik, kullaniciYakin ? HIGH : LOW);
            } else {
                digitalWrite(akilliIsik, (kisiSayisi > 0 && curLdr > karanlikLimit) ? HIGH : LOW);
            }
        }
    }

    // Zamanlayıcı Temizlikleri
    if (msgActive && now > msgTimer) { 
        if (currentPage == 1) tft.fillRect(0, 185, 320, 55, C_BG); 
        msgActive = false; 
    }
    if (tL > 0 && (now - tL > 1500)) tL = 0;
    if (tR > 0 && (now - tR > 1500)) tR = 0;
}