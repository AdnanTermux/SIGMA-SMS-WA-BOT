'use strict';

/**
 * index.js  –  v5  (Sigma OTP Manager)
 * Entry point: starts Telegram bot, restores WhatsApp sessions, starts token pollers.
 */

const fs    = require('fs-extra');
const path  = require('path');
const chalk = require('chalk');

const { getConfig, getSessionBaseDir } = require('./config');
const { createTelegramBot }            = require('./telegram');
const {
  startWhatsAppForUser, setTelegramBot, stopAllSockets, getSocket,
} = require('./whatsapp');
const tokenPolling = require('./tokenPolling');
const db           = require('./database');

// ─── Ensure directories ───────────────────────────────────────────────────────
fs.ensureDirSync(path.join(__dirname, 'sessions'));
fs.ensureDirSync(path.join(__dirname, 'tmp'));

// ─── File logger ──────────────────────────────────────────────────────────────
const LOG_FILE = path.join(__dirname, 'bot.log');
const _origErr = console.error.bind(console);
console.error = (...args) => {
  _origErr(...args);
  fs.appendFile(LOG_FILE, `[${new Date().toISOString()}] ERROR: ${args.join(' ')}\n`).catch(() => {});
};

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(chalk.magenta('╔══════════════════════════════════════╗'));
  console.log(chalk.magenta('║  Sigma OTP Manager  v5.0.0           ║'));
  console.log(chalk.magenta('║  Multi-User · Token Polling          ║'));
  console.log(chalk.magenta('╚══════════════════════════════════════╝'));

  const cfg = getConfig();
  if (!cfg.telegram?.token || cfg.telegram.token === 'YOUR_BOT_TOKEN') {
    console.error(chalk.red('[FATAL] Set your Telegram bot token in config.json'));
    process.exit(1);
  }

  // 1. Start Telegram bot
  let tgBot;
  try {
    tgBot = createTelegramBot();
  } catch (err) {
    console.error(chalk.red('[FATAL] Telegram bot failed:'), err.message);
    process.exit(1);
  }

  // 2. Wire Telegram bot into WhatsApp module
  setTelegramBot(tgBot);

  // 3. Init token polling with bot + socket accessor
  tokenPolling.init(tgBot, getSocket);

  // 4. Restore WhatsApp sessions
  const sessBase = getSessionBaseDir();
  let restored   = 0;
  try {
    const userIds = db.getAllUserIds();
    for (const userId of userIds) {
      const sessDir = path.join(sessBase, String(userId));
      if (fs.existsSync(path.join(sessDir, 'creds.json'))) {
        try {
          await startWhatsAppForUser(userId);
          restored++;
          console.log(chalk.green(`[Main] Restored WA session for user ${userId}`));
        } catch (err) {
          console.error(chalk.red(`[Main] Failed to restore WA session for ${userId}:`), err.message);
        }
      }
    }
  } catch (err) {
    console.error(chalk.yellow('[Main] Session restore error:'), err.message);
  }
  console.log(chalk.blue(`[Main] Restored ${restored} WhatsApp session(s).`));

  // 5. Resume active token pollers
  tokenPolling.restartAllActive();

  console.log(chalk.green('[Main] ✅ Bot is ready. Users can /start to begin.'));

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = (signal) => {
    console.log(chalk.yellow(`\n[Main] ${signal} – shutting down…`));
    stopAllSockets();
    try { tgBot.stopPolling(); } catch (_) {}
    process.exit(0);
  };
  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch(err => {
  console.error(chalk.red('[FATAL]'), err);
  process.exit(1);
});