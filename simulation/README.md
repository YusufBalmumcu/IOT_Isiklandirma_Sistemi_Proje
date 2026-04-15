# IoT Simülasyon Projesi

Bu proje, bir sensör ağı senaryosunu taklit etmek için geliştirilmiş uçtan uca (end-to-end) bir IoT (Nesnelerin İnterneti) simülasyonudur. Proje, gerçek zamanlı veri üreten bir MQTT tabanlı simülatör, bu verileri toplayıp depolayan bir arka plan (backend) ve bu verileri görselleştiren modern bir ön yüz (frontend) barındırmaktadır.

## 🚀 Projenin Amacı ve Özellikleri

- **Sensör Simülasyonu**: MQTT protokolü üzerinden rastgele sıcaklık, nem ve ışık sensör verileri üretilmesi (`publisher`).
- **Veri Toplama ve Depolama**: MQTT Broker üzerinden dinlenen verilerin bir SQLite veritabanında saklanması (`subscriber`).
- **RESTful API**: Veritabanındaki ölçüm verilerinin ve istatistiklerinin istemcilere sunulması (FastAPI).
- **Gerçek Zamanlı Monitörleme**: Frontend üzerinden sensör verilerinin grafikler halinde canlı (polling tabanlı) olarak izlenmesi, varyans, ortalama gibi değerlerin gösterilmesi.

---

## 🛠 Kullanılan Teknolojiler

### Backend (Arka Yüz)
- **Python (3.x)**
- **FastAPI:** Hızlı ve asenkron REST API sunumu için.
- **Uvicorn:** FastAPI uygulaması için ASGI web sunucusu.
- **Paho-MQTT:** Cihazların birbiri ile haberleşebilmesi ve telemetri verilerinin iletimi için (Mosquitto vb. bir broker gerektirir).
- **SQLite:** Ölçüm verilerini basit, dosya tabanlı olarak kaydetmek için.

### Frontend (Ön Yüz)
- **React (v19):** Kullanıcı arayüzünü oluşturmak için.
- **Vite:** Çok hızlı geliştirme (dev) ortamı ve build aracı.
- **Tailwind CSS:** Modern ve esnek bir UI tasarımı için.
- **Recharts:** Sensör verilerini (sıcaklık, nem, ışık vb.) canlı grafiklerle görselleştirmek için.
- **Axios:** Backend'deki FastAPI uç noktalarına HTTP istekleri atmak için.

---

## 📂 Klasör Yapısı

```text
IoT_Simulation/
├── backend/
│   ├── api.py              # FastAPI sunucu (Veri sağlayan uç noktalar)
│   ├── publisher.py        # MQTT ile sahte sensör verisi üreten script
│   ├── subscriber.py       # MQTT'den veri okuyup SQLite'a yazan script
│   ├── iot_data.db         # SQLite veritabanı (subscriber tarafından yaratılır)
│   ├── requirements.txt    # Backend bağımlılıkları listesi
│   └── venv/               # (Önerilen) Python sanal ortamı
├── frontend/
│   ├── src/                # React kaynak kodları (App.jsx vb.)
│   ├── public/             # Statik dosyalar
│   ├── package.json        # Frontend bağımlılıkları ve vitescriptleri
│   ├── vite.config.js      # Vite yapılandırması
│   └── eslint.config.js    # Lint yapılandırmaları
└── README.md               # Projenin dökümantasyonu
```

---

## ⚙️ Gereksinimler

Projeyi kendi ortamınızda çalıştırabilmek için aşağıdakilerin kurulu olması gerekir:
- **Node.js**: (Min. v18.x ve üzeri önerilir) NPM veya Yarn ile frontend bağımlılıklarını kurmak için.
- **Python**: (Min. v3.8+, 3.14 dahil uyumlu) Backend tarafı için.
- **MQTT Broker**: Ortamınızda çalışan bir MQTT broker'a ihtiyacınız var. En çok tercih edilen seçenek **[Eclipse Mosquitto](https://mosquitto.org/)**'dur. Kurulum sonrası yerel makinenizde tcp 1883 portunu dinlemelidir.

---

## 🚀 Kurulum ve Çalıştırma

### 1. MQTT Broker (Mosquitto)
Eğer kurulu değilse bir MQTT Broker ayağa kaldırın. Windows ortamında Mosquitto servisini başlatın veya Docker kullanıyorsanız:
```bash
docker run -it -p 1883:1883 eclipse-mosquitto
```

### 2. Backend Kurulumu
Backend dizinine girin ve sanal ortam yaratarak bağımlılıkları yükleyin:

```bash
cd backend

# Sanal ortam yaratma (İsteğe bağlı fakat önerilir)
python -m venv venv

# Windows için sanal ortamı aktif etme
.\venv\Scripts\activate
# (macOS/Linux için: source venv/bin/activate)

# Bağımlılıkları yükleme
pip install -r requirements.txt
```

Backend servislerini çalıştırmak için 3 farklı terminal açıp aşağıdaki komutları ayrı ayrı çalıştırın:

**Terminal 1:** REST API (FastAPI) Sunucusu
```bash
cd backend
# Sanal ortam akif edilmiş olmalı!
uvicorn api:app --reload
```

**Terminal 2:** MQTT Subscriber (Veritabanına Veri Yazan Dinleyici)
```bash
cd backend
python subscriber.py
```

**Terminal 3:** MQTT Publisher (Simüle edilmiş Veri Üreten Kaynak)
```bash
cd backend
python publisher.py
```

*Not: Hata almamak için paho-mqtt kütüphanesinin (özellikle v2+) uyumlu kullanımı (CallbackAPIVersion tanımları) `publisher.py` ve `subscriber.py` içerisinde yapılmıştır.*

### 3. Frontend Kurulumu
Frontend arayüzünü çalıştırmak için yeni bir terminal açın:

```bash
cd frontend

# Bağımlılıkların kurulması
npm install

# Geliştirme sunucusunun başlatılması
npm run dev
```

Başladıktan sonra terminalde çıkan adrese (genellikle `http://localhost:5173/`) tarayıcınız üzerinden giderek IoT dashboard'u görüntüleyebilirsiniz. Veriler, backend üzerinden Recharts grafikleri ile eş zamanlı ve canlı olarak ön yüzü besleyecektir.

---

## 📈 İzleme ve Özellikler
Görsel gösterge paneli (Dashboard) üzerinden aşağıdakileri görebilirsiniz:
- **Sıcaklık, Nem ve Işık Grafikleri**: Sürekli güncellenen zamana dayalı (time-series) çizgi grafikleri.
- **İstatistiksel Kartlar**: Sensörlerin okudukları **Minimum, Maksimum, Ortalama** ve aynı zamanda standart bir formülle hesaplanmış sapmayı gösteren **Varyans** değerleri panoları.
