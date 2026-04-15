import paho.mqtt.client as mqtt
import json
import time
import random
from datetime import datetime, timezone

# --- AYARLAR ---
BROKER_ADDRESS = "localhost"  # Mosquitto yerel bilgisayarında çalıştığı için localhost
PORT = 1883                   # Varsayılan MQTT portu
TEAM_NO = "13"                # Kendi takım numaranı buraya yazmayı unutma!
TOPIC = f"{TEAM_NO}/telemetry"
SENSOR_ID = "temp_01"         # Dokümanda istenen örnek ID
SLEEP_TIME = 2

def generate_sensor_data():
    """Rastgele sensör verileri üretir ve istenen JSON formatında paketler."""
    # Gerçekçi değer aralıklarında rastgele sayılar üret
    sicaklik = round(random.uniform(15.0, 35.0), 1) # 15.0 ile 35.0 derece arası
    nem = random.randint(30, 80)                    # %30 ile %80 arası nem
    isik = random.randint(100, 800)                 # 100 ile 800 lüx arası ışık
    
    # Dokümanda istenen formatta güncel zaman damgası (ISO 8601, UTC)
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # JSON yapısını oluştur (Ödevdeki formata birebir uygun)
    payload = {
        "sensor_id": SENSOR_ID,
        "values": {
            "sicaklik": sicaklik,
            "nem": nem,
            "isik": isik
        },
        "unit": "metric",
        "timestamp": timestamp
    }
    
    return json.dumps(payload) # Sözlüğü JSON string formatına çevirir

def on_connect(client, userdata, flags, rc):
    """Broker'a bağlanıldığında tetiklenen fonksiyon."""
    if rc == 0:
        print(f"Başarılı! Yerel MQTT Broker'a bağlanıldı.")
    else:
        print(f"Bağlantı hatası! Dönüş Kodu: {rc}")

# --- MQTT İSTEMCİ KURULUMU ---
client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1, "Simulasyon_Publisher")
client.on_connect = on_connect

try:
    # Broker'a bağlan
    client.connect(BROKER_ADDRESS, PORT, 60)
    
    # Arka plan işlemlerini başlat
    client.loop_start()

    print(f"Hedef Topic: {TOPIC} - Veri üretimi başlıyor...\n(Durdurmak için CTRL+C tuşlarına basın)\n")

    # Sonsuz döngü ile periyodik veri gönderimi
    while True:
        json_data = generate_sensor_data()
        
        # Veriyi MQTT topic'ine yayımla (publish)
        client.publish(TOPIC, json_data)
        
        print(f"Yayınlandı -> {json_data}")
        
        # Saniyede bir veri göndersin (İsteğe bağlı değiştirebilirsin)
        time.sleep(SLEEP_TIME)

except KeyboardInterrupt:
    print("\nKullanıcı tarafından durduruldu.")
finally:
    client.loop_stop()
    client.disconnect()
    print("Bağlantı güvenle kapatıldı."),


# uvicorn api:app --reload