#!/usr/bin/env node
// supervisor.js
// Simple process supervisor that launches server.js and discord_bot.js as child processes,
// restarts them on failure with exponential backoff, and forwards their stdout/stderr.

require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');

const APP_DIR = __dirname;
const SERVICES = [
  { name: 'server', script: path.join(APP_DIR, 'server.js') },
  { name: 'bot', script: path.join(APP_DIR, 'discord_bot.js') },
];

const children = new Map();

function spawnService(svc) {
  const maxBackoff = 30 * 1000; // 30s
  const base = 1000;
  const attempt = (svc._attempts || 0) + 1;
  svc._attempts = attempt;
  const backoff = Math.min(base * Math.pow(2, attempt - 1), maxBackoff);

  console.log(`[supervisor] starting ${svc.name} (attempt ${attempt})`);
  const child = spawn(process.execPath, [svc.script], {
    env: Object.assign({}, process.env),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (d) => process.stdout.write(`[${svc.name}] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[${svc.name} ERR] ${d}`));

  child.on('exit', (code, signal) => {
    console.warn(`[supervisor] ${svc.name} exited with code=${code} signal=${signal}`);
    children.delete(svc.name);
    // restart if not intentionally killed
    if (!svc._stopping) {
      console.log(`[supervisor] will restart ${svc.name} in ${backoff}ms`);
      setTimeout(() => spawnService(svc), backoff);
    }
  });

  child.on('error', (err) => {
    console.error(`[supervisor] ${svc.name} spawn error:`, err.message || err);
  });

  children.set(svc.name, child);
  return child;
}

function startAll() {
  for (const svc of SERVICES) {
    svc._stopping = false;
    svc._attempts = 0;
    spawnService(svc);
  }
}

function stopAll(cb) {
  if (children.size === 0) return cb && cb();
  let remaining = children.size;
  for (const [name, child] of children) {
    const svc = SERVICES.find(s => s.name === name) || {};
    svc._stopping = true;
    try {
      child.once('exit', () => {
        remaining -= 1;
        if (remaining === 0) cb && cb();
      });
      child.kill('SIGTERM');
      // force kill after timeout
      setTimeout(() => {
        if (!child.killed) {
          try { child.kill('SIGKILL'); } catch(e){}
        }
      }, 5000);
    } catch (e) {
      remaining -= 1;
    }
  }
}

process.on('SIGINT', () => {
  console.log('\n[supervisor] SIGINT received, stopping children...');
  stopAll(() => process.exit(0));
});

process.on('SIGTERM', () => {
  console.log('\n[supervisor] SIGTERM received, stopping children...');
  stopAll(() => process.exit(0));
});

// start
startAll();

console.log('[supervisor] started. Press Ctrl+C to stop.');
