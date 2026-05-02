'use strict';

/**
 * tokenPolling.js  –  Sigma OTP Manager
 *
 * Background polling for each user's active secret panel tokens.
 * Polls GET /api/sms?token=...&limit=20 from tempnum.net every poll_interval_ms.
 * New OTPs are forwarded to all user's forwardDestinations using the correct formatter.
 */

const axios = require('axios');
const chalk = require('chalk');

const { getApiBaseUrl, getPollInterval } = require('./config');
const db = require('./database');
const { maskPhone, guessCountryFromPhone, detectService } = require('./utils');
const { buildOtpMessage }         = require('./themeFormatter');
const { buildWhatsAppOtpMessage } = require('./whatsappThemeFormatter');

// Map<`${userId}:${tokenId}`, intervalId>
const _intervals = new Map();

let _tgBot   = null;
let _getSocket = null;

function init(tgBot, getSocketFn) {
  _tgBot     = tgBot;
  _getSocket = getSocketFn;
}

// ─── Start polling for one token ──────────────────────────────────────────────
function startPolling(userId, tokenId) {
  const key = `${userId}:${tokenId}`;
  if (_intervals.has(key)) return; // already running

  const interval = getPollInterval();
  console.log(chalk.blue(`[Poll] Starting ${key} every ${interval / 1000}s`));

  const id = setInterval(() => _poll(userId, tokenId), interval);
  _intervals.set(key, id);

  // Poll immediately on start
  _poll(userId, tokenId);
}

// ─── Stop polling for one token ───────────────────────────────────────────────
function stopPolling(userId, tokenId) {
  const key = `${userId}:${tokenId}`;
  const id  = _intervals.get(key);
  if (id) {
    clearInterval(id);
    _intervals.delete(key);
    console.log(chalk.yellow(`[Poll] Stopped ${key}`));
  }
}

// ─── Stop all polling for a user ──────────────────────────────────────────────
function stopAllForUser(userId) {
  for (const key of [..._intervals.keys()]) {
    if (key.startsWith(`${userId}:`)) {
      clearInterval(_intervals.get(key));
      _intervals.delete(key);
    }
  }
}

// ─── Restart all active tokens (on bot startup) ───────────────────────────────
function restartAllActive() {
  const active = db.getAllActiveTokenUsers();
  for (const { userId, token } of active) {
    startPolling(userId, token.id);
  }
  console.log(chalk.blue(`[Poll] Resumed ${active.length} active token poller(s).`));
}

// ─── Internal: poll one token ─────────────────────────────────────────────────
async function _poll(userId, tokenId) {
  const tok = db.getToken(userId, tokenId);
  if (!tok || tok.status !== 'active') {
    stopPolling(userId, tokenId);
    return;
  }

  const baseUrl = getApiBaseUrl();
  const url     = `${baseUrl}/api/sms?token=${tok.token}&limit=20`;

  let data;
  try {
    const res = await axios.get(url, { timeout: 10000 });
    data = res.data;
  } catch (err) {
    console.error(chalk.red(`[Poll:${userId}:${tokenId}]`), err.message);
    return;
  }

  const records = Array.isArray(data?.data) ? data.data : [];
  if (!records.length) return;

  const last      = tok.lastReceivedAt;
  const newRecord = records.filter(r => !last || r.received_at > last);
  if (!newRecord.length) return;

  // Sort ascending
  newRecord.sort((a, b) => (a.received_at > b.received_at ? 1 : -1));

  for (const rec of newRecord) {
    await _forwardTokenOtp(userId, tokenId, tok, rec);
  }

  // Update last received
  const newest = newRecord[newRecord.length - 1].received_at;
  db.updateTokenLastReceived(userId, tokenId, newest);
}

// ─── Forward one OTP from token API ──────────────────────────────────────────
async function _forwardTokenOtp(userId, tokenId, tok, rec) {
  const otp     = rec.otp || rec.code || '';
  const phone   = rec.number || '';
  const svc     = rec.service || detectService(rec.message || '') || 'Unknown';
  const cty     = rec.country || 'Unknown';
  const rawMsg  = rec.message || '';
  const masked  = maskPhone(phone);
  const { flag } = guessCountryFromPhone(phone);
  const theme   = db.getUserSetting(userId, 'theme') ?? 0;
  const cfg     = require('./config').getConfig();
  const panel   = cfg.bot?.name || 'Sigma OTP Manager';

  if (!otp) return;

  console.log(chalk.cyan(`[Poll:${userId}] ${otp} · ${masked} · ${svc}`));
  db.addOtpRecord(userId, { phoneMasked: masked, otp, service: svc, country: cty, source: 'token' });

  const dests = db.getDestinations(userId);
  if (!dests.length) {
    console.log(chalk.yellow(`[Poll:${userId}] No destinations configured.`));
    return;
  }

  for (const dest of dests) {
    try {
      if (dest.type === 'telegram') {
        if (!_tgBot) continue;
        const text = buildOtpMessage(theme, masked, otp, rawMsg, svc, cty, flag, panel);
        const kb   = {
          inline_keyboard: [[
            { text: '📋 Copy OTP', copy_text: { text: otp } },
          ]],
        };
        const sent = await _tgBot.sendMessage(dest.chatId, text, {
          parse_mode:   'HTML',
          reply_markup: kb,
        });
        // Auto-delete after 15 min
        setTimeout(() => _tgBot.deleteMessage(dest.chatId, sent.message_id).catch(() => {}), 15 * 60_000);
        console.log(chalk.blue(`[Poll:${userId}] → TG ${dest.chatId} "${dest.name}"`));
      } else if (dest.type === 'whatsapp' || dest.type === 'whatsappChannel') {
        const sock = _getSocket ? _getSocket(userId) : null;
        if (!sock) continue;
        const waText = buildWhatsAppOtpMessage(theme, masked, otp, rawMsg, svc, cty, flag, panel);
        await sock.sendMessage(dest.jid, { text: waText });
        console.log(chalk.blue(`[Poll:${userId}] → WA ${dest.type} "${dest.name}"`));
      }
    } catch (err) {
      console.error(chalk.red(`[Poll:${userId}] fwd to ${dest.name}:`), err.message);
    }
  }
}

module.exports = { init, startPolling, stopPolling, stopAllForUser, restartAllActive };