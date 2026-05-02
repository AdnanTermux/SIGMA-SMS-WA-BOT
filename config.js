'use strict';

const fs   = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'config.json');

const DEFAULT = {
  telegram: { token: 'YOUR_BOT_TOKEN', superadmin_ids: [123456789] },
  whatsapp: { command_prefix: '.', session_base_dir: 'sessions' },
  api: {
    base_url:        'https://tempnum.net',
    poll_interval_ms: 30000,
  },
  bot: {
    name:            'Sigma OTP Manager',
    developer:       '@NONEXPERTCODER',
    number_bot_link: 'https://t.me/YourNumberBot',
    support_link:    'https://t.me/YourSupport',
  },
  public_stats_api: 'https://tempnum.net/api/public/stats',
  OTP_GUI_THEME:    0,
};

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT, null, 2));
    console.log('[config] Created default config.json – edit it before running.');
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

let _cfg = loadConfig();

function getConfig() {
  try { _cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch (_) {}
  return _cfg;
}

function setConfigKey(key, value) {
  const cfg = getConfig();
  cfg[key] = value;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
  _cfg = cfg;
}

function isSuperAdmin(telegramId) {
  return (getConfig().telegram?.superadmin_ids || []).includes(Number(telegramId));
}

function getPrefix() {
  return getConfig().whatsapp?.command_prefix || '.';
}

function getSessionBaseDir() {
  return path.resolve(getConfig().whatsapp?.session_base_dir || 'sessions');
}

function getUserSessionDir(userId) {
  return path.join(getSessionBaseDir(), String(userId));
}

function getApiBaseUrl() {
  return getConfig().api?.base_url || 'https://tempnum.net';
}

function getPollInterval() {
  return getConfig().api?.poll_interval_ms || 30000;
}

module.exports = {
  getConfig, setConfigKey, isSuperAdmin, getPrefix,
  getSessionBaseDir, getUserSessionDir, getApiBaseUrl, getPollInterval,
};