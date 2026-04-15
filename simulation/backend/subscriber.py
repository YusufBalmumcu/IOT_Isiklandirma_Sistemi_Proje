import paho.mqtt.client as mqtt
import json
import sqlite3

# --- AYARLAR ---
BROKER_ADDRESS = "localhost"
PORT = 1883
TEAM_NO = "13"
TOPIC = f"{TEAM_NO}/telemetry"
DB_NAME = "iot_data.db"

def init_db():
    """Veritabanını ve tabloyu oluşturur (eğer yoksa)."""
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sensor_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sensor_id TEXT NOT NULL,
                sicaklik REAL,
                nem REAL,
                isik REAL,
                timestamp TEXT NOT NULL
            )
        ''')
        conn.commit()
    print(f"Veritabanı '{DB_NAME}' başarıyla kontrol edildi/oluşturuldu.")

def on_connect(client, userdata, flags, rc):
    """Broker'a bağlanıldığında çalışır ve topic'e abone olur."""
    if rc == 0:
        print(f"Başarılı! Broker'a bağlanıldı. '{TOPIC}' dinleniyor...")
        # Bağlantı başarılıysa belirtilen topic'e abone ol (subscribe)
        client.subscribe(TOPIC)
    else:
        print(f"Bağlantı hatası! Kod: {rc}")

def on_message(client, userdata, msg):
    """Abone olunan topic'e yeni bir mesaj geldiğinde tetiklenir."""
    try:
        # Gelen mesajı (byte formatında gelir) string'e ve ardından JSON'a çevir
        payload = msg.payload.decode('utf-8')
        data = json.loads(payload)
        
        # JSON içinden verileri ayıkla
        sensor_id = data.get("sensor_id")
        sicaklik = data["values"].get("sicaklik")
        nem = data["values"].get("nem")
        isik = data["values"].get("isik")
        timestamp = data.get("timestamp")
        
        # Veritabanına kaydet
        with sqlite3.connect(DB_NAME) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO sensor_data (sensor_id, sicaklik, nem, isik, timestamp)
                VALUES (?, ?, ?, ?, ?)
            ''', (sensor_id, sicaklik, nem, isik, timestamp))
            conn.commit()
            
        print(f"Veritabanına Kaydedildi -> Sicaklik: {sicaklik}, Nem: {nem}, Isik: {isik}")

    except json.JSONDecodeError:
        print("Hata: Gelen mesaj geçerli bir JSON formatında değil.")
    except KeyError as e:
        print(f"Hata: JSON verisinde beklenen bir anahtar bulunamadı: {e}")
    except Exception as e:
        print(f"Bilinmeyen bir hata oluştu: {e}")

# --- ANA PROGRAM ---
if __name__ == "__main__":
    # Önce veritabanını hazırla
    init_db()

    # MQTT İstemcisini kur
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1, "Simulasyon_Subscriber")
    client.on_connect = on_connect
    client.on_message = on_message

    print("Bağlantı kuruluyor...")
    
    try:
        client.connect(BROKER_ADDRESS, PORT, 60)
        
        # loop_forever() programın kapanmasını engeller ve sürekli dinlemede kalmasını sağlar
        client.loop_forever()
        
    except KeyboardInterrupt:
        print("\nDinleme işlemi kullanıcı tarafından durduruldu.")
    finally:
        client.disconnect()
        print("Bağlantı kapatıldı.")