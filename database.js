'use strict';

/**
 * database.js  –  v5  (Sigma OTP Manager)
 *
 * Per-user data:
 * {
 *   "users": {
 *     "<telegramId>": {
 *       "sessions": [],
 *       "forwardDestinations": [
 *         { id, type: 'telegram'|'whatsapp'|'whatsappChannel', chatId?, jid?, name }
 *       ],
 *       "tokens": [
 *         { id, token, status: 'pending'|'active'|'rejected', lastReceivedAt, addedAt }
 *       ],
 *       "otpHistory": [],
 *       "settings": { otp_enabled, command_prefix, theme },
 *       "stats": { total_otps, daily:{}, hourly:{} },
 *       "registeredAt": ISO string
 *     }
 *   },
 *   "allUserIds": [],
 *   "globalStats": { total_users, total_tokens, total_otps_forwarded }
 * }
 */

const fs   = require('fs');
const path = require('path');

const DB_PATH  = path.join(__dirname, 'database.json');
const TMP_PATH = DB_PATH + '.tmp';

const DEFAULT_USER = () => ({
  sessions:            [],
  forwardDestinations: [],
  tokens:              [],
  otpHistory:          [],
  settings: {
    otp_enabled:    true,
    command_prefix: '.',
    theme:          0,
  },
  stats: {
    total_otps: 0,
    daily:      {},
    hourly:     {},
  },
  registeredAt: new Date().toISOString(),
});

// ─── Load / save ──────────────────────────────────────────────────────────────
function load() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ users: {}, allUserIds: [], globalStats: { total_users: 0, total_tokens: 0, total_otps_forwarded: 0 } }, null, 2));
  }
  try {
    const raw = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    if (!raw.users)       raw.users      = {};
    if (!raw.allUserIds)  raw.allUserIds = [];
    if (!raw.globalStats) raw.globalStats = { total_users: 0, total_tokens: 0, total_otps_forwarded: 0 };
    return raw;
  } catch (_) {
    return { users: {}, allUserIds: [], globalStats: { total_users: 0, total_tokens: 0, total_otps_forwarded: 0 } };
  }
}

function save(db) {
  fs.writeFileSync(TMP_PATH, JSON.stringify(db, null, 2));
  fs.renameSync(TMP_PATH, DB_PATH);
}

// ─── User helpers ─────────────────────────────────────────────────────────────
function ensureUser(db, userId) {
  const id = String(userId);
  if (!db.users[id]) {
    db.users[id] = DEFAULT_USER();
    if (!db.allUserIds.includes(Number(userId))) {
      db.allUserIds.push(Number(userId));
      db.globalStats.total_users = db.allUserIds.length;
    }
  }
  const u = db.users[id];
  if (!u.sessions)            u.sessions            = [];
  if (!u.forwardDestinations) u.forwardDestinations = [];
  if (!u.tokens)              u.tokens              = [];
  if (!u.otpHistory)          u.otpHistory          = [];
  if (!u.settings)            u.settings            = DEFAULT_USER().settings;
  if (!u.stats)               u.stats               = DEFAULT_USER().stats;
  if (u.settings.theme === undefined) u.settings.theme = 0;
  return u;
}

function getUserData(userId) {
  const db = load();
  return ensureUser(db, userId);
}

function saveUserData(userId, userData) {
  const db = load();
  ensureUser(db, userId);
  db.users[String(userId)] = userData;
  if (!db.allUserIds.includes(Number(userId))) db.allUserIds.push(Number(userId));
  save(db);
}

function getAllUserIds() {
  return load().allUserIds;
}

function getGlobalStats() {
  return load().globalStats;
}

function incrementGlobalOtps() {
  const db = load();
  db.globalStats.total_otps_forwarded = (db.globalStats.total_otps_forwarded || 0) + 1;
  save(db);
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function getUserSetting(userId, key) {
  return getUserData(userId).settings[key];
}

function setUserSetting(userId, key, value) {
  const db = load();
  const u  = ensureUser(db, userId);
  u.settings[key] = value;
  save(db);
}

// ─── Sessions ─────────────────────────────────────────────────────────────────
function addSession(userId, { sessionId, phone, status = 'active' }) {
  const db = load();
  const u  = ensureUser(db, userId);
  u.sessions = u.sessions.filter(s => s.sessionId !== sessionId);
  u.sessions.push({ sessionId, phone, status, createdAt: new Date().toISOString() });
  save(db);
}

function getSessions(userId) {
  return getUserData(userId).sessions;
}

function deleteSession(userId, sessionId) {
  const db = load();
  const u  = ensureUser(db, userId);
  u.sessions = u.sessions.filter(s => s.sessionId !== sessionId);
  save(db);
}

function updateSessionStatus(userId, sessionId, status) {
  const db = load();
  const u  = ensureUser(db, userId);
  const s  = u.sessions.find(s => s.sessionId === sessionId);
  if (s) { s.status = status; save(db); }
}

// ─── Forward Destinations (multi-type: telegram, whatsapp, whatsappChannel) ──
/**
 * dest: { type: 'telegram'|'whatsapp'|'whatsappChannel', chatId?, jid?, name }
 */
function addDestination(userId, dest) {
  const db = load();
  const u  = ensureUser(db, userId);

  // Dedup
  const key = dest.type === 'telegram' ? String(dest.chatId) : dest.jid;
  if (u.forwardDestinations.find(d =>
    d.type === dest.type && (d.type === 'telegram' ? String(d.chatId) === key : d.jid === key)
  )) {
    throw new Error(`Destination already exists.`);
  }

  const maxId = u.forwardDestinations.reduce((m, d) => Math.max(m, d.id || 0), 0);
  const newDest = {
    id:      maxId + 1,
    type:    dest.type,
    name:    dest.name || key,
    addedAt: new Date().toISOString(),
  };
  if (dest.type === 'telegram') {
    newDest.chatId = dest.chatId;
  } else {
    newDest.jid  = dest.jid;
  }

  u.forwardDestinations.push(newDest);
  save(db);
  return newDest;
}

function getDestinations(userId) {
  return getUserData(userId).forwardDestinations;
}

function deleteDestination(userId, id) {
  const db     = load();
  const u      = ensureUser(db, userId);
  const before = u.forwardDestinations.length;
  u.forwardDestinations = u.forwardDestinations.filter(d => d.id !== Number(id));
  save(db);
  return u.forwardDestinations.length < before;
}

// ─── Tokens ───────────────────────────────────────────────────────────────────
function addToken(userId, token) {
  const db  = load();
  const u   = ensureUser(db, userId);
  const exists = u.tokens.find(t => t.token === token);
  if (exists) throw new Error('Token already exists.');
  const id  = require('crypto').randomBytes(4).toString('hex');
  const tok = { id, token, status: 'pending', lastReceivedAt: null, addedAt: new Date().toISOString() };
  u.tokens.push(tok);
  db.globalStats.total_tokens = (db.globalStats.total_tokens || 0) + 1;
  save(db);
  return tok;
}

function getTokens(userId) {
  return getUserData(userId).tokens;
}

function getToken(userId, tokenId) {
  return getUserData(userId).tokens.find(t => t.id === tokenId);
}

function updateTokenStatus(userId, tokenId, status) {
  const db = load();
  const u  = ensureUser(db, userId);
  const t  = u.tokens.find(t => t.id === tokenId);
  if (t) { t.status = status; save(db); return true; }
  return false;
}

function updateTokenLastReceived(userId, tokenId, receivedAt) {
  const db = load();
  const u  = ensureUser(db, userId);
  const t  = u.tokens.find(t => t.id === tokenId);
  if (t) { t.lastReceivedAt = receivedAt; save(db); }
}

function deleteToken(userId, tokenId) {
  const db     = load();
  const u      = ensureUser(db, userId);
  const before = u.tokens.length;
  u.tokens     = u.tokens.filter(t => t.id !== tokenId);
  save(db);
  return u.tokens.length < before;
}

/** Return all users that have at least one active token */
function getAllActiveTokenUsers() {
  const db  = load();
  const out = [];
  for (const [uid, u] of Object.entries(db.users)) {
    for (const t of (u.tokens || [])) {
      if (t.status === 'active') out.push({ userId: uid, token: t });
    }
  }
  return out;
}

// ─── OTP History ──────────────────────────────────────────────────────────────
function addOtpRecord(userId, { phoneMasked, otp, service, country, source }) {
  const db  = load();
  const u   = ensureUser(db, userId);
  const now = new Date().toISOString();
  u.otpHistory.unshift({
    phoneMasked: phoneMasked || '••••••••••',
    otp,
    service:    service  || 'Unknown',
    country:    country  || 'Unknown',
    source:     source   || 'whatsapp',
    receivedAt: now,
  });
  if (u.otpHistory.length > 300) u.otpHistory = u.otpHistory.slice(0, 300);

  // Update per-user stats
  u.stats.total_otps = (u.stats.total_otps || 0) + 1;
  const day  = now.slice(0, 10);
  const hour = now.slice(0, 13);
  u.stats.daily[day]   = (u.stats.daily[day]   || 0) + 1;
  u.stats.hourly[hour] = (u.stats.hourly[hour] || 0) + 1;

  // Global counter
  db.globalStats.total_otps_forwarded = (db.globalStats.total_otps_forwarded || 0) + 1;

  save(db);
}

function getOtpHistory(userId, limit = 20) {
  return getUserData(userId).otpHistory.slice(0, limit);
}

function clearOtpHistory(userId) {
  const db = load();
  const u  = ensureUser(db, userId);
  u.otpHistory = [];
  save(db);
}

// ─── Per-user stats ───────────────────────────────────────────────────────────
function getUserStats(userId) {
  const history = getUserData(userId).otpHistory;
  const now     = new Date();
  const today   = now.toISOString().slice(0, 10);
  const hourAgo = new Date(now - 3_600_000).toISOString();

  const total     = history.length;
  const otpsToday = history.filter(r => r.receivedAt?.startsWith(today)).length;
  const lastHour  = history.filter(r => r.receivedAt >= hourAgo).length;
  const byService = {};
  for (const r of history) byService[r.service] = (byService[r.service] || 0) + 1;

  return { total, otpsToday, lastHour, byService };
}

// ─── Pending token requests (for admin) ───────────────────────────────────────
function getAllPendingTokens() {
  const db  = load();
  const out = [];
  for (const [uid, u] of Object.entries(db.users)) {
    for (const t of (u.tokens || [])) {
      if (t.status === 'pending') out.push({ userId: uid, token: t });
    }
  }
  return out;
}

module.exports = {
  getUserData, saveUserData, getAllUserIds, getGlobalStats, incrementGlobalOtps,
  getUserSetting, setUserSetting,
  addSession, getSessions, deleteSession, updateSessionStatus,
  addDestination, getDestinations, deleteDestination,
  addToken, getTokens, getToken, updateTokenStatus, updateTokenLastReceived,
  deleteToken, getAllActiveTokenUsers,
  addOtpRecord, getOtpHistory, clearOtpHistory,
  getUserStats, getAllPendingTokens,
};