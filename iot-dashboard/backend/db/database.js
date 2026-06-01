const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '../data/iot.db');
let db = null;

// sql.js senkron wrapper
let SQL = null;

async function initDb() {
  if (db) return db;

  SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  initSchema();
  setupAutosave();
  return db;
}

function saveDb() {
  if (!db) return;
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function setupAutosave() {
  setInterval(saveDb, 10000); // 10 saniyede bir kaydet
  process.on('exit', saveDb);
  process.on('SIGINT', () => { saveDb(); process.exit(0); });
}

function initSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'viewer',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sensor_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER,
      event_type TEXT NOT NULL,
      person_count INTEGER,
      light_state INTEGER,
      ldr_value INTEGER,
      sensor1_distance REAL,
      sensor2_distance REAL,
      direction TEXT,
      message TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER,
      alert_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      message TEXT NOT NULL,
      value REAL,
      threshold REAL,
      acknowledged INTEGER DEFAULT 0,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Odalar tablosu — her oda bağımsız mod ve eşiğe sahip
  // LDR global (tek sensör tüm sistem için) — ldr_value burada tutulmaz, rooms.current_ldr ile takip edilir
  db.run(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      mqtt_cmd_topic TEXT NOT NULL,
      light_mode TEXT DEFAULT 'manual',
      ldr_threshold INTEGER DEFAULT 1500,
      light_state INTEGER DEFAULT 0,
      person_count INTEGER DEFAULT 0,
      current_ldr INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Işık kontrol log tablosu — kim, ne zaman, hangi modda, neden
  db.run(`
    CREATE TABLE IF NOT EXISTS light_control_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      triggered_by TEXT NOT NULL,
      action TEXT NOT NULL,
      new_light_state INTEGER,
      new_mode TEXT,
      ldr_value INTEGER,
      ldr_threshold INTEGER,
      person_count INTEGER,
      note TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(room_id) REFERENCES rooms(id)
    );
  `);

  // Varsayılan admin
  const existing = db.exec("SELECT id FROM users WHERE username = 'admin'");
  if (!existing.length || !existing[0].values.length) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.run('INSERT INTO users (username, password_hash, role) VALUES (?,?,?)', ['admin', hash, 'admin']);
    console.log('[DB] Varsayılan admin oluşturuldu: admin / admin123');
    saveDb();
  }

  // Varsayılan oda (Salon) — sonradan daha fazla eklenebilir
  const roomExists = db.exec("SELECT id FROM rooms WHERE name = 'Salon'");
  if (!roomExists.length || !roomExists[0].values.length) {
    db.run(
      `INSERT INTO rooms (name, mqtt_cmd_topic, light_mode, ldr_threshold) VALUES (?, ?, ?, ?)`,
      ['Salon', 'tarim_isik/1/command', 'manual', 1500]
    );
    console.log('[DB] Varsayılan oda oluşturuldu: Salon');
    saveDb();
  }

  // ─── Migrasyonlar (Eski veritabanı dosyaları için schema güncellemeleri) ───
  try {
    db.run("UPDATE rooms SET mqtt_cmd_topic = 'tarim_isik/1/command' WHERE name = 'Salon'");
    saveDb();
  } catch(e) {}
  try {
    db.run("ALTER TABLE sensor_logs ADD COLUMN room_id INTEGER;");
    console.log('[DB] Migrasyon: sensor_logs tablosuna room_id sütunu eklendi.');
    saveDb();
  } catch (err) {
    // Sütun zaten varsa hata fırlatır, yoksay
  }

  try {
    db.run("ALTER TABLE alerts ADD COLUMN room_id INTEGER;");
    console.log('[DB] Migrasyon: alerts tablosuna room_id sütunu eklendi.');
    saveDb();
  } catch (err) {
    // Yoksay
  }

  try {
    db.run("ALTER TABLE rooms ADD COLUMN current_ldr INTEGER DEFAULT 0;");
    console.log('[DB] Migrasyon: rooms tablosuna current_ldr sütunu eklendi.');
    saveDb();
  } catch (err) {
    // Yoksay
  }
}

// sql.js için senkron yardımcılar
function dbGet(query, params = []) {
  const stmt = db.prepare(query);
  stmt.bind(params);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row;
}

function dbAll(query, params = []) {
  const result = db.exec(query.replace(/\?/g, (_, i) => {
    const p = params[i];
    return typeof p === 'string' ? `'${p.replace(/'/g, "''")}'` : (p === null || p === undefined ? 'NULL' : p);
  }));
  if (!result.length) return [];
  const cols = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    cols.forEach((c, i) => obj[c] = row[i]);
    return obj;
  });
}

function dbRun(query, params = []) {
  const stmt = db.prepare(query);
  stmt.run(params);
  stmt.free();
  return { lastInsertRowid: db.exec('SELECT last_insert_rowid()')[0]?.values[0][0] };
}

function getDb() {
  return { get: dbGet, all: dbAll, run: dbRun };
}

module.exports = { initDb, getDb, saveDb };
