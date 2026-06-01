require('dotenv').config();
const express = require('express');
const expressWs = require('express-ws');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { initDb } = require('./db/database');
const { connectMqtt, addWsClient, startSimulator } = require('./mqttService');
const { startDiscovery } = require('./discoveryService');
const { wsAuthMiddleware } = require('./middleware/auth');
const authRoutes  = require('./routes/auth');
const dataRoutes  = require('./routes/data');
const roomRoutes  = require('./routes/rooms');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

async function start() {
  await initDb();
  console.log('[DB] Veritabanı hazır ✓');

  const app = express();
  expressWs(app);

  app.use(cors({ origin: '*' }));
  app.use(express.json());

  app.use('/api/auth',  authRoutes);
  app.use('/api/data',  dataRoutes);
  app.use('/api/rooms', roomRoutes);

  app.ws('/ws', (ws, req) => {
    const token = req.query.token;
    const user = wsAuthMiddleware(token);
    if (!user) { ws.send(JSON.stringify({ type: 'error', message: 'Yetkisiz' })); ws.close(); return; }
    console.log(`[WS] Bağlandı: ${user.username}`);
    ws.send(JSON.stringify({ type: 'connected', message: 'Canlı veri akışı aktif' }));
    addWsClient(ws);
    ws.on('close', () => console.log(`[WS] Ayrıldı: ${user.username}`));
  });

  app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

  const frontendBuild = path.join(__dirname, '../frontend/build');
  if (fs.existsSync(frontendBuild)) {
    app.use(express.static(frontendBuild));
    app.get('*', (req, res) => res.sendFile(path.join(frontendBuild, 'index.html')));
  }

  const PORT = process.env.PORT || 3001;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 IoT Dashboard: http://localhost:${PORT}`);
    console.log(`📡 WebSocket: ws://localhost:${PORT}/ws?token=<jwt>\n`);
    startDiscovery(PORT);
    if (process.env.MQTT_SIMULATE === 'true') startSimulator();
    else connectMqtt();
  });
}

start().catch(console.error);
