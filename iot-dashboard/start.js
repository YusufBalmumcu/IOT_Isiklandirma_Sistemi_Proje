/**
 * Akıllı Işıklandırma Sistemi - Başlatıcı (Launcher)
 * 
 * Varsayılan olarak sadece Backend ve Web arayüzünü (Frontend) başlatır.
 * Gerçek ESP32 cihazınızla sorunsuz çalışması için simülatörü dışarıda bırakır.
 * 
 * Ekstra parametreler:
 *   node start.js --with-sim     (Simülatörü de başlatır)
 *   node start.js --with-mobile  (Flutter mobil uygulamayı da başlatır)
 */

const { spawn, execSync, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const START_SIMULATOR = args.includes('--with-sim');
const START_MOBILE = args.includes('--with-mobile');

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

console.log(`\n${COLORS.bright}${COLORS.blue}====================================================${COLORS.reset}`);
console.log(`${COLORS.bright}${COLORS.blue}   IOT DASHBOARD BAŞLATICI (BACKEND & WEB)          ${COLORS.reset}`);
console.log(`${COLORS.bright}${COLORS.blue}====================================================${COLORS.reset}\n`);

// ─── BAĞIMLILIK KONTROLÜ ─────────────────────────────────────────────────────
function checkAndInstallDeps(dirName) {
  const dirPath = path.join(__dirname, dirName);
  const nodeModulesPath = path.join(dirPath, 'node_modules');
  
  if (!fs.existsSync(nodeModulesPath) && fs.existsSync(path.join(dirPath, 'package.json'))) {
    console.log(`${COLORS.yellow}[SYSTEM] '${dirName}' için paketler yükleniyor, lütfen bekleyin...${COLORS.reset}`);
    try {
      execSync('npm install', { cwd: dirPath, stdio: 'inherit' });
      console.log(`${COLORS.green}[SYSTEM] '${dirName}' paketleri başarıyla yüklendi ✓${COLORS.reset}\n`);
    } catch (err) {
      console.error(`${COLORS.red}[SYSTEM] '${dirName}' paketleri yüklenirken hata oluştu!${COLORS.reset}`);
      process.exit(1);
    }
  }
}

checkAndInstallDeps('backend');
checkAndInstallDeps('frontend');
if (START_SIMULATOR) checkAndInstallDeps('simulator');

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
    name: 'Web UI',
    color: COLORS.magenta,
    dir: 'frontend',
    command: 'npm',
    args: ['start'],
    env: process.env
  }
];

if (START_SIMULATOR) {
  SERVICES.push({
    name: 'Simulator',
    color: COLORS.cyan,
    dir: 'simulator',
    command: 'node',
    args: ['simulator.js'],
    env: process.env
  });
  console.log(`${COLORS.cyan}[INFO] Simülatör modülü aktif edildi.${COLORS.reset}`);
}

if (START_MOBILE) {
  SERVICES.push({
    name: 'Mobile',
    color: COLORS.yellow,
    dir: 'mobile',
    command: 'flutter',
    args: ['run'],
    env: process.env,
    interactive: true
  });
  console.log(`${COLORS.yellow}[INFO] Mobil uygulama aktif edildi.${COLORS.reset}`);
}

const activeProcesses = [];

function killProcessTree(childProcess) {
  const pid = childProcess.pid;
  if (!pid) return;

  if (process.platform === 'win32') {
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
  const isWindows = process.platform === 'win32';

  for (let i = 0; i < SERVICES.length; i++) {
    if (isCleaningUp) break;

    const service = SERVICES[i];
    
    // Backend'in açılmasına zaman tanımak için kısa bekleme
    if (i > 0) await new Promise(resolve => setTimeout(resolve, 2000));
    if (isCleaningUp) break;

    console.log(`${service.color}[SYSTEM] ${service.name} başlatılıyor...${COLORS.reset}`);

    let cmd = service.command;
    if (isWindows) {
      if (cmd === 'npm') cmd = 'npm.cmd';
      if (cmd === 'flutter') cmd = 'flutter.bat';
    }

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

    child.on('error', (err) => {
      console.error(`${COLORS.red}[SYSTEM] ${service.name} başlatılırken hata oluştu: ${err.message}${COLORS.reset}`);
      cleanup();
    });

    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) console.log(`${service.color}[${service.name}]${COLORS.reset} ${line.trim()}`);
      });
    });

    child.stderr.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) console.error(`${COLORS.red}[${service.name} Error]${COLORS.reset} ${line.trim()}`);
      });
    });

    if (service.interactive && typeof process.stdin.setRawMode === 'function') {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (key) => {
        if (key === '\u0003') cleanup(); // Ctrl+C
        else child.stdin.write(key);
      });
    }

    child.on('close', (code) => {
      console.log(`${service.color}[SYSTEM] ${service.name} kapandı (kod: ${code})${COLORS.reset}`);
      if (code !== 0 && !isCleaningUp) {
        console.error(`${COLORS.red}[SYSTEM] ${service.name} beklenmedik şekilde kapandı.${COLORS.reset}`);
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
