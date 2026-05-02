'use strict';

/**
 * whatsapp.js  –  v5  (Sigma OTP Manager)
 *
 * Each Telegram user gets their own isolated Baileys socket.
 * OTPs are forwarded to ALL destinations (Telegram groups + WhatsApp groups/channels).
 * NOT sent to user's private chat – only to explicitly added destinations.
 */

const path  = require('path');
const fs    = require('fs-extra');
const chalk = require('chalk');
const pino  = require('pino');

const { getUserSessionDir }       = require('./config');
const { extractOtpFromMessage }   = require('./otpRegex');
const { buildOtpMessage }         = require('./themeFormatter');
const { buildWhatsAppOtpMessage } = require('./whatsappThemeFormatter');
const {
  maskPhone, guessCountryFromPhone, detectService, btn, DEV_BTN,
} = require('./utils');
const db            = require('./database');
const { handleCommand } = require('./commands');

// ─── Global socket registry ───────────────────────────────────────────────────
const userSockets = new Map();

// Telegram bot reference (set by index.js)
let _tgBot = null;
function setTelegramBot(bot) { _tgBot = bot; }

// ─── Public API ───────────────────────────────────────────────────────────────
function getSocket(userId)   { return userSockets.get(String(userId))?.sock || null; }
function getUptime(userId)   { const e = userSockets.get(String(userId)); return e ? Date.now() - e.startTime : 0; }
function isConnected(userId) { return userSockets.has(String(userId)) && userSockets.get(String(userId)).connected; }

function getUptimesMap() {
  const m = new Map();
  for (const [uid, entry] of userSockets) m.set(uid, entry.startTime);
  return m;
}

// ─── Start a session for one user ─────────────────────────────────────────────
async function startWhatsAppForUser(userId) {
  const uid = String(userId);

  const existing = userSockets.get(uid);
  if (existing) {
    clearTimeout(existing.reconnTimer);
    try { existing.sock.end(undefined); } catch (_) {}
    userSockets.delete(uid);
  }

  const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
  } = require('@whiskeysockets/baileys');

  const sessDir = getUserSessionDir(uid);
  await fs.ensureDir(sessDir);

  const { state, saveCreds } = await useMultiFileAuthState(sessDir);
  const { version }          = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth:              state,
    logger:            pino({ level: 'silent' }),
    printQRInTerminal: true,
    browser:           ['Sigma OTP Manager', 'Chrome', '124.0.6367.82'],
    connectTimeoutMs:  60_000,
    getMessage:        async () => ({ conversation: '' }),
  });

  sock.userId = uid;

  const entry = { sock, startTime: Date.now(), connected: false, reconnTimer: null, reconnAttempt: 0 };
  userSockets.set(uid, entry);

  sock.ev.on('creds.update', saveCreds);

  // ── Connection updates ─────────────────────────────────────────────────────
  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      entry.connected     = true;
      entry.reconnAttempt = 0;
      console.log(chalk.green(`[WA:${uid}] ✓ Connected`));
      // Notify via Telegram only if bot is available – no private message about OTPs
      if (_tgBot) {
        _tgBot.sendMessage(uid, '✅ <b>WhatsApp connected!</b> OTP forwarding is active.', { parse_mode: 'HTML' }).catch(() => {});
      }
    }

    if (connection === 'close') {
      entry.connected = false;
      const code      = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      console.log(chalk.red(`[WA:${uid}] Disconnected (code: ${code})`));

      if (loggedOut) {
        console.log(chalk.red(`[WA:${uid}] Logged out.`));
        if (_tgBot) _tgBot.sendMessage(uid, '⚠️ <b>WhatsApp logged out.</b> Use /pair to re-link.', { parse_mode: 'HTML' }).catch(() => {});
        userSockets.delete(uid);
        return;
      }

      entry.reconnAttempt++;
      const delay = Math.min(5000 * 2 ** (entry.reconnAttempt - 1), 120_000);
      console.log(chalk.yellow(`[WA:${uid}] Reconnecting in ${delay / 1000}s…`));
      entry.reconnTimer = setTimeout(() => startWhatsAppForUser(uid), delay);
    }
  });

  // ── Messages ───────────────────────────────────────────────────────────────
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      try { await _onMessage(uid, sock, msg); }
      catch (err) { console.error(chalk.red(`[WA:${uid}] msg error:`), err.message); }
    }
  });
}

async function restartWhatsAppForUser(userId) {
  console.log(chalk.yellow(`[WA:${userId}] Restarting…`));
  await startWhatsAppForUser(userId);
}

function stopAllSockets() {
  for (const [uid, entry] of userSockets) {
    clearTimeout(entry.reconnTimer);
    try { entry.sock.end(undefined); } catch (_) {}
    console.log(chalk.yellow(`[WA:${uid}] Stopped.`));
  }
  userSockets.clear();
}

// ─── Message handler ──────────────────────────────────────────────────────────
async function _onMessage(userId, sock, msg) {
  if (msg.key?.remoteJid === 'status@broadcast') return;

  const body = _extractBody(msg);
  if (!body) return;

  // 1. Commands (owner's own messages only)
  if (await handleCommand(sock, msg, body, getUptimesMap())) return;

  // 2. OTP extraction (inbound only)
  if (msg.key?.fromMe) return;
  if (!db.getUserSetting(userId, 'otp_enabled')) return;

  const otp = extractOtpFromMessage(body);
  if (!otp) return;

  const sender          = msg.key?.remoteJid || '';
  const phone           = sender.replace(/@.+$/, '').replace(/^(\d+)$/, '+$1');
  const masked          = maskPhone(phone);
  const { country, flag } = guessCountryFromPhone(phone);
  const service         = detectService(body);
  const theme           = db.getUserSetting(userId, 'theme') ?? 0;
  const cfg             = require('./config').getConfig();
  const panel           = cfg.bot?.name || 'Sigma OTP Manager';

  console.log(chalk.cyan(`[OTP:${userId}] ${otp} · ${masked} · ${service}`));
  db.addOtpRecord(userId, { phoneMasked: masked, otp, service, country, source: 'whatsapp' });

  // 3. Forward ONLY to user-added destinations (NOT to private Telegram chat)
  const dests = db.getDestinations(userId);
  if (!dests.length) {
    console.log(chalk.yellow(`[OTP:${userId}] No destinations. Use /addgroup to add one.`));
    return;
  }

  for (const dest of dests) {
    try {
      if (dest.type === 'telegram') {
        // Telegram destination → HTML theme with animated emojis
        if (!_tgBot) continue;
        const text = buildOtpMessage(theme, masked, otp, body, service, country, flag, panel);
        const kb   = {
          inline_keyboard: [
            [btn('📋 Copy OTP',     { copy: otp,  style: 'success', icon: 'copy' })],
            [btn('📩 Copy Message', { copy: body, style: 'primary', icon: 'clipboard' })],
            [DEV_BTN],
          ],
        };
        const sent = await _tgBot.sendMessage(dest.chatId, text, {
          parse_mode:   'HTML',
          reply_markup: kb,
        });
        setTimeout(() => _tgBot.deleteMessage(dest.chatId, sent.message_id).catch(() => {}), 15 * 60_000);
        console.log(chalk.blue(`[OTP:${userId}] → TG ${dest.chatId} "${dest.name}"`));
      } else if (dest.type === 'whatsapp' || dest.type === 'whatsappChannel') {
        // WhatsApp destination → plain-text theme with WA markdown
        const waText = buildWhatsAppOtpMessage(theme, masked, otp, body, service, country, flag, panel);
        await sock.sendMessage(dest.jid, { text: waText });
        console.log(chalk.blue(`[OTP:${userId}] → WA ${dest.type} "${dest.name}"`));
      }
    } catch (err) {
      console.error(chalk.red(`[OTP:${userId}] fwd ${dest.name}:`), err.message);
    }
  }
}

// ─── Body extractor ───────────────────────────────────────────────────────────
function _extractBody(msg) {
  const m = msg.message;
  if (!m) return null;
  return (
    m.conversation                                ||
    m.extendedTextMessage?.text                   ||
    m.imageMessage?.caption                       ||
    m.videoMessage?.caption                       ||
    m.documentMessage?.caption                    ||
    m.buttonsResponseMessage?.selectedDisplayText ||
    m.listResponseMessage?.title                  ||
    null
  );
}

module.exports = {
  startWhatsAppForUser, restartWhatsAppForUser, stopAllSockets,
  getSocket, getUptime, isConnected, setTelegramBot, getUptimesMap,
};