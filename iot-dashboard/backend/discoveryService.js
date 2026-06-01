const dgram = require('dgram');
const os = require('os');

/**
 * Bilgisayarın yerel ağdaki aktif IPv4 adreslerini bulur.
 */
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Sadece IPv4 ve harici (lokal loopback olmayan) adresleri al
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

/**
 * UDP Broadcast yayını başlatır.
 * @param {number} port Backend web sunucusunun port numarası (örn: 3001)
 */
function startDiscovery(port) {
  const server = dgram.createSocket('udp4');

  server.on('listening', () => {
    try {
      server.setBroadcast(true);
      console.log('[Discovery] UDP Keşif sunucusu aktif ✓ (Mobil uygulama otomatik IP bulabilir)');
    } catch (e) {
      console.error('[Discovery] setBroadcast hatası:', e.message);
    }
  });

  server.on('error', (err) => {
    console.error('[Discovery] Hata:', err.message);
  });

  // Her 3 saniyede bir yerel ağa IP adreslerimizi duyur
  setInterval(() => {
    const ips = getLocalIPs();
    if (ips.length === 0) return;

    const payload = JSON.stringify({
      service: 'iot-dashboard-backend',
      ips: ips,
      port: port
    });

    // 255.255.255.255 adresine broadcast (genel yayın) gönderiyoruz
    server.send(payload, 4545, '255.255.255.255', (err) => {
      if (err) {
        // Hataları sessizce yutabiliriz (ağ bağlantısı olmaması vb. durumlarda oluşabilir)
      }
    });
  }, 3000);

  // Herhangi bir boş porttan bind et
  server.bind(0);
}

module.exports = { startDiscovery };
