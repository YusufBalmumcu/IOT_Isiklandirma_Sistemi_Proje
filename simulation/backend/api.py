from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
import statistics

app = FastAPI()

# CORS Ayarları: React'in bu API'den veri çekerken hata almasını engeller
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Geliştirme aşamasında her yere izin veriyoruz
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_NAME = "iot_data.db"

def get_db_connection():
    """Veritabanı bağlantısını kurar."""
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row  # Verileri sözlük (dictionary) formatında almamızı sağlar
    return conn

@app.get("/api/sensors/history")
def get_sensor_history(limit: int = 50):
    """React'teki grafikler için son 'limit' kadar veriyi döndürür."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # En yeni verileri al (ORDER BY timestamp DESC)
    cursor.execute("SELECT * FROM sensor_data ORDER BY timestamp DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    
    # Grafikte soldan sağa doğru akması için listeyi tersine çeviriyoruz (eskiden yeniye)
    data = [dict(row) for row in reversed(rows)]
    return data

@app.get("/api/sensors/stats")
def get_sensor_stats():
    """Son 50 veriyi baz alarak Min, Max, Ortalama ve Varyans değerlerini hesaplar."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT sicaklik, nem, isik FROM sensor_data ORDER BY timestamp DESC LIMIT 50")
    rows = cursor.fetchall()
    conn.close()

    # Veri yoksa boş döndür
    if not rows:
        return {"message": "Henüz veri yok"}

    # Sütunları ayrı listelere ayır
    sicaklik_list = [row['sicaklik'] for row in rows if row['sicaklik'] is not None]
    nem_list = [row['nem'] for row in rows if row['nem'] is not None]
    isik_list = [row['isik'] for row in rows if row['isik'] is not None]

    # İstatistik hesaplama fonksiyonu
    def calc_stats(data_list):
        if len(data_list) < 2: # Varyans için en az 2 veri gerekir
            return {"min": 0, "max": 0, "ort": 0, "varyans": 0}
        return {
            "min": round(min(data_list), 2),
            "max": round(max(data_list), 2),
            "ort": round(statistics.mean(data_list), 2),
            "varyans": round(statistics.variance(data_list), 2)
        }

    # İstenen formatta React'e gönderilecek JSON yanıtı
    return {
        "sicaklik": calc_stats(sicaklik_list),
        "nem": calc_stats(nem_list),
        "isik": calc_stats(isik_list)
    }