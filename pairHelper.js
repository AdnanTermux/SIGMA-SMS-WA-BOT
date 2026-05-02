'use strict';

/**
 * pairHelper.js  –  v4  (multi-user)
 *
 * requestPairingCode(phoneNumber, userId)
 *   1. Creates tmp/pair_<userId>_<ts>/ temp session.
 *   2. Waits for Baileys 'connecting' state (WS handshake done).
 *   3. Calls sock.requestPairingCode(phone).
 *   4. Returns { code, waitForConnection }.
 *      waitForConnection resolves on 'open', copies creds to sessions/<userId>/.
 *   5. Retries up to 3 times with exponential back-off.
 */

const path  = require('path');
const fs    = require('fs-extra');
const chalk = require('chalk');
const { getUserSessionDir } = require('./config');

const MAX_RETRIES   = 3;
const READY_TIMEOUT = 30_000;
const LINK_TIMEOUT  = 120_000;

async function requestPairingCode(phoneNumber, userId) {
  const cleanPhone = String(phoneNumber).replace(/\D/g, '');
  if (!cleanPhone || cleanPhone.length < 7) throw new Error('Invalid phone number');

  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await _tryPair(cleanPhone, userId, attempt);
    } catch (err) {
      lastErr = err;
      console.error(chalk.red(`[pair:${userId}] Attempt ${attempt}/${MAX_RETRIES}: ${err.message}`));
      if (attempt < MAX_RETRIES) await _sleep(4000 * attempt);
    }
  }
  throw lastErr;
}

async function _tryPair(cleanPhone, userId, attempt) {
  const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
  } = require('@whiskeysockets/baileys');
  const pino = require('pino');

  const mainDir = getUserSessionDir(userId);
  const tmpDir  = path.join(__dirname, 'tmp', `pair_${userId}_${Date.now()}_${attempt}`);

  await fs.ensureDir(tmpDir);
  await fs.ensureDir(mainDir);

  const { state, saveCreds } = await useMultiFileAuthState(tmpDir);
  const { version }          = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth:              state,
    logger:            pino({ level: 'silent' }),
    printQRInTerminal: false,
    mobile:            false,
    browser:           ['Multi-User OTP Manager', 'Chrome', '124.0.6367.82'],
    connectTimeoutMs:  READY_TIMEOUT,
    qrTimeout:         0,
  });

  sock.ev.on('creds.update', saveCreds);

  // Step 1: wait for 'connecting' (WS handshake done)
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WS handshake timeout')), READY_TIMEOUT);
    sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
      if (connection === 'connecting' || connection === 'open') {
        clearTimeout(timer); resolve();
      }
      if (connection === 'close') {
        clearTimeout(timer);
        reject(new Error(`Socket closed (code ${lastDisconnect?.error?.output?.statusCode})`));
      }
    });
  });

  // Step 2: request pairing code
  let code;
  try {
    code = String(await sock.requestPairingCode(cleanPhone)).toUpperCase().trim();
  } catch (err) {
    await _cleanup(sock, tmpDir);
    throw new Error(`requestPairingCode failed: ${err.message}`);
  }

  console.log(chalk.green(`[pair:${userId}] Code for +${cleanPhone}: ${code}`));

  // Step 3: wait for device to link
  const waitForConnection = new Promise((resolve, reject) => {
    const timer = setTimeout(async () => {
      await _cleanup(sock, tmpDir);
      reject(new Error('Device not linked within 2 minutes'));
    }, LINK_TIMEOUT);

    sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
      if (connection === 'open') {
        clearTimeout(timer);
        try {
          await fs.copy(tmpDir, mainDir, { overwrite: true });
          console.log(chalk.green(`[pair:${userId}] ✓ Credentials saved.`));
        } catch (e) {
          console.error(chalk.red(`[pair:${userId}] Copy creds failed: ${e.message}`));
        }
        await _cleanup(sock, tmpDir);
        resolve();
      }
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        if (code === DisconnectReason.loggedOut) {
          clearTimeout(timer);
          await _cleanup(sock, tmpDir);
          reject(new Error('Pairing rejected by WhatsApp'));
        }
      }
    });

    sock.ev.on('creds.update', saveCreds);
  });

  return { code, waitForConnection };
}

async function _cleanup(sock, tmpDir) {
  try { sock.end(undefined); } catch (_) {}
  try { await fs.remove(tmpDir); } catch (_) {}
}

function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { requestPairingCode };
