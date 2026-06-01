/**
 * Akıllı Işıklandırma Sistemi - Çoklu Servis Başlatıcı
 * 
 * Bu script tüm IoT sistem bileşenlerini sırasıyla başlatır:
 * 1. Backend (port 3001)
 * 2. Simülatör (MQTT veri yayınlayıcı)
 * 3. Web Dashboard (React Frontend)
 * 4. Mobil (Flutter - Cihaz bağlıysa opsiyonel)
 * 
 * Kullanım:
 *   node start.js
 */

const { spawn, execSync, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

console.log(`${COLORS.bright}${COLORS.blue}====================================================${COLORS.reset}`);
console.log(`${COLORS.bright}${COLORS.blue}   SMART LIGHTING SYSTEM - ALL-IN-ONE LAUNCHER      ${COLORS.reset}`);
console.log(`${COLORS.bright}${COLORS.blue}====================================================${COLORS.reset}\n`);

// ─── BAĞIMLILIK KONTROLÜ VE YÜKLEME ──────────────────────────────────────────
function checkAndInstallDeps(dirName) {
  const dirPath = path.join(__dirname, dirName);
  const nodeModulesPath = path.join(dirPath, 'node_modules');
  
  if (!fs.existsSync(nodeModulesPath) && fs.existsSync(path.join(dirPath, 'package.json'))) {
    console.log(`${COLORS.yellow}[SYSTEM] '${dirName}' için bağımlılıklar yükleniyor, lütfen bekleyin...${COLORS.reset}`);
    try {
      execSync('npm install', { cwd: dirPath, stdio: 'inherit' });
      console.log(`${COLORS.green}[SYSTEM] '${dirName}' bağımlılıkları başarıyla yüklendi ✓${COLORS.reset}\n`);
    } catch (err) {
      console.error(`${COLORS.red}[SYSTEM] '${dirName}' bağımlılıkları yüklenirken hata oluştu!${COLORS.reset}`);
      process.exit(1);
    }
  }
}

checkAndInstallDeps('backend');
checkAndInstallDeps('simulator');
checkAndInstallDeps('frontend');

// ─── FLUTTER CİHAZ KONTROLÜ ──────────────────────────────────────────────────
let hasMobileDevice = false;
try {
  const devices = execSync('flutter devices', { encoding: 'utf8', timeout: 5000 });
  if (devices && !devices.includes('No devices available')) {
    hasMobileDevice = true;
    console.log(`${COLORS.green}[SYSTEM] Flutter cihazı algılandı, Mobil uygulama da başlatılacak.${COLORS.reset}`);
  } else {
    console.log(`${COLORS.yellow}[SYSTEM] Bağlı Flutter cihazı bulunamadı. Mobil uygulama başlatılmayacak (opsiyonel).${COLORS.reset}`);
  }
} catch (e) {
  console.log(`${COLORS.dim}[SYSTEM] Flutter CLI bulunamadı veya cihaz sorgulanamadı. Mobil uygulama adımı atlanıyor.${COLORS.reset}`);
}

// ─── SERVİS TANIMLARI ────────────────────────────────────────────────────────
const SERVICES = [
  {
    name: 'Backend',
    color: COLORS.green,
    dir: 'backend',
    command: 'npm',
    args: ['start'],
    env: { ...process.env, PORT: '3001' }
  },
  {
    name: 'Simulator',
    color: COLORS.cyan,
    dir: 'simulator',
    command: 'node',
    args: ['simulator.js'],
    env: process.env
  },
  {
    name: 'Web UI',
    color: COLORS.magenta,
    dir: 'frontend',
    command: 'npm',
    args: ['start'],
    env: process.env
  }
];

if (hasMobileDevice) {
  SERVICES.push({
    name: 'Mobile',
    color: COLORS.yellow,
    dir: 'mobile',
    command: 'flutter',
    args: ['run'],
    env: process.env,
    interactive: true // Stdin yönlendirmesi için (hot-reload 'r' tuşu vb.)
  });
}

const activeProcesses = [];

function killProcessTree(childProcess) {
  const pid = childProcess.pid;
  if (!pid) return;

  if (process.platform === 'win32') {
    // Windows üzerinde tüm alt süreçleri (tree) zorla sonlandır
    exec(`taskkill /pid ${pid} /T /F`, () => {});
  } else {
    try {
      process.kill(-pid);
    } catch (e) {
      try { childProcess.kill('SIGTERM'); } catch(err) {}
    }
  }
}

// ─── SERVİSLERİ BAŞLATMA DÖNGÜSÜ ─────────────────────────────────────────────
async function startServices() {
  const isWindows = process.platform === 'win32' || process.env.OS === 'Windows_NT' || process.platform === 'cygwin' || process.platform === 'msys';

  for (let i = 0; i < SERVICES.length; i++) {
    if (isCleaningUp) break;

    const service = SERVICES[i];
    
    // Gecikmeli başlatma (Backend'in önce açılması için)
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, i === 1 ? 2500 : 1000));
    }
    if (isCleaningUp) break;

    console.log(`${service.color}[SYSTEM] ${service.name} başlatılıyor...${COLORS.reset}`);

    // Windows uyumluluğu için npm.cmd veya flutter.bat kullanılması gerekir
    let cmd = service.command;
    if (isWindows) {
      if (cmd === 'npm') cmd = 'npm.cmd';
      if (cmd === 'flutter') cmd = 'flutter.bat';
    }

    // Safely clone environment variables, discarding undefined/null values to avoid spawn EINVAL
    const safeEnv = {};
    if (service.env) {
      for (const [key, val] of Object.entries(service.env)) {
        if (val !== undefined && val !== null) {
          safeEnv[key] = String(val);
        }
      }
    }

    const child = spawn(cmd, service.args, {
      cwd: path.join(__dirname, service.dir),
      env: safeEnv,
      stdio: service.interactive ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
      detached: !isWindows,
      shell: true
    });

    activeProcesses.push({ name: service.name, process: child });

    // Hata durumunda hemen yakala
    child.on('error', (err) => {
      console.error(`${COLORS.red}[SYSTEM] ${service.name} başlatılırken hata oluştu: ${err.message}${COLORS.reset}`);
      cleanup();
    });

    // Çıktıları renklendirerek konsola yaz
    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          console.log(`${service.color}[${service.name}]${COLORS.reset} ${line.trim()}`);
        }
      });
    });

    child.stderr.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          console.error(`${COLORS.red}[${service.name} Error]${COLORS.reset} ${line.trim()}`);
        }
      });
    });

    // Mobil uygulama interaktif ise terminal tuş vuruşlarını yönlendir (hot reload için)
    if (service.interactive && typeof process.stdin.setRawMode === 'function') {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (key) => {
        // Ctrl+C basılırsa çıkış yap
        if (key === '\u0003') {
          cleanup();
        } else {
          child.stdin.write(key);
        }
      });
    }

    child.on('close', (code) => {
      console.log(`${service.color}[SYSTEM] ${service.name} kapandı (kod: ${code})${COLORS.reset}`);
      if (code !== 0 && !isCleaningUp) {
        console.error(`${COLORS.red}[SYSTEM] Kritik servis ${service.name} beklenmedik şekilde kapandı. Tüm servisler durduruluyor...${COLORS.reset}`);
        cleanup();
      }
    });
  }
}

// ─── TEMİZ KAPATMA ───────────────────────────────────────────────────────────
let isCleaningUp = false;
function cleanup() {
  if (isCleaningUp) return;
  isCleaningUp = true;
  
  console.log(`\n\n${COLORS.bright}${COLORS.red}[SYSTEM] Tüm servisler kapatılıyor...${COLORS.reset}`);
  
  activeProcesses.forEach(item => {
    console.log(`${COLORS.dim}[SYSTEM] ${item.name} sonlandırılıyor...${COLORS.reset}`);
    killProcessTree(item.process);
  });

  setTimeout(() => {
    console.log(`${COLORS.green}[SYSTEM] Kapatma tamamlandı. İyi çalışmalar!${COLORS.reset}\n`);
    process.exit(0);
  }, 1000);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

startServices().catch(err => {
  console.error('[SYSTEM] Hata:', err);
  cleanup();
});
