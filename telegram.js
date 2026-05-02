'use strict';

/**
 * telegram.js  –  v5  (Sigma OTP Manager)
 *
 * Full command set including:
 *   - Token management (/addtoken, /mytokens, /deltoken)
 *   - Admin approval workflow
 *   - /addgroup supporting Telegram chat IDs
 *   - Admin panel (/admin, /listusers, /broadcast, etc.)
 */

const TelegramBot = require('node-telegram-bot-api');
const chalk       = require('chalk');

const { getConfig, isSuperAdmin, getUserSessionDir } = require('./config');
const { requestPairingCode } = require('./pairHelper');
const {
  startWhatsAppForUser, restartWhatsAppForUser,
  getSocket, getUptime, isConnected,
} = require('./whatsapp');
const tokenPolling = require('./tokenPolling');
const db = require('./database');
const {
  formatUptime, fetchPublicStats, progressBar,
  btn, sendBox, editBox, DEV_BTN, suppBtn, maskToken, escHtml,
} = require('./utils');

// ─── Box helpers ──────────────────────────────────────────────────────────────
function send(bot, chatId, text, extra = {}) {
  return bot.sendMessage(chatId, text, { parse_mode: 'HTML', ...extra });
}
function edit(bot, chatId, msgId, text, extra = {}) {
  return bot.editMessageText(text, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', ...extra }).catch(() => {});
}

// ─── Theme names ──────────────────────────────────────────────────────────────
const THEME_NAMES = [
  '0  Classic ⭐',    '1  Minimal 🎯',     '2  Developer 👨‍💻',
  '3  Electric ⚡',   '4  Tech 🔬',         '5  Premium 💎',
  '6  Ultraminimal 🎲','7  Business 💼',    '8  Social 🌐',
  '9  Deluxe 🌟',     '10 Elegance 📝',    '11 Rainbow 🌈',
  '12 Focus 🎯',      '13 Royal 👑',        '14 Luxury 🚁',
];

// ─── Per-user guard ───────────────────────────────────────────────────────────
function guard(bot, msg, cb) {
  const userId = msg.from?.id;
  if (!userId) return;
  db.getUserData(userId); // ensure user exists
  Promise.resolve().then(() => cb(userId)).catch(err => {
    console.error(chalk.red(`[TG:${userId}]`), err.message);
    bot.sendMessage(msg.chat.id, `❌ ${escHtml(err.message)}`, { parse_mode: 'HTML' }).catch(() => {});
  });
}

function adminGuard(bot, msg, cb) {
  if (!isSuperAdmin(msg.from?.id)) {
    bot.sendMessage(msg.chat.id, '🚫 Superadmin only.').catch(() => {});
    return;
  }
  guard(bot, msg, cb);
}

// ─── Notify all superadmins ───────────────────────────────────────────────────
function notifyAdmins(bot, text, extra = {}) {
  const admins = getConfig().telegram?.superadmin_ids || [];
  for (const adminId of admins) {
    bot.sendMessage(adminId, text, { parse_mode: 'HTML', ...extra }).catch(() => {});
  }
}

// ─── Main factory ─────────────────────────────────────────────────────────────
function createTelegramBot() {
  const cfg   = getConfig();
  const token = cfg.telegram?.token;
  if (!token || token === 'YOUR_BOT_TOKEN') throw new Error('Telegram token not set in config.json');

  const bot = new TelegramBot(token, { polling: true });
  console.log(chalk.green('[Telegram] Bot started ✓'));

  // ── /start ──────────────────────────────────────────────────────────────────
  bot.onText(/\/start/, (msg) => guard(bot, msg, (userId) => {
    const c      = getConfig();
    const stats  = db.getUserStats(userId);
    const conn   = isConnected(userId);
    const theme  = db.getUserSetting(userId, 'theme') ?? 0;
    const otpOn  = db.getUserSetting(userId, 'otp_enabled');
    const tokens = db.getTokens(userId);
    const active = tokens.filter(t => t.status === 'active').length;
    sendBox(bot, msg.chat.id,
      `🤖 ${c.bot?.name || 'Sigma OTP Manager'}`,
      [
        `👋 Welcome, <b>${escHtml(msg.from.first_name)}</b>!`,
        ``,
        `📊 Your OTPs:   <b>${stats.total}</b>`,
        `📅 Today:       <b>${stats.otpsToday}</b>`,
        `⏱ Last hour:   <b>${stats.lastHour}</b>`,
        ``,
        `🎨 Theme:    <b>#${theme}</b>`,
        `🔛 OTP:      <b>${otpOn ? 'ON ✅' : 'OFF 🔴'}</b>`,
        `📡 WhatsApp: <b>${conn ? '🟢 Connected' : '🔴 Offline'}</b>`,
        `🔑 Tokens:   <b>${active} active</b>`,
        ``,
        `Use /menu for all commands.`,
      ],
      [
        [
          btn('📋 Menu',   { cb: 'menu',   style: 'primary', icon: 'clipboard' }),
          btn('📊 Stats',  { cb: 'stats',  style: 'success', icon: 'stats'     }),
          btn('📡 Status', { cb: 'status', style: 'primary', icon: 'satellite' }),
        ],
        [DEV_BTN],
      ]
    );
  }));

  // ── /pair ────────────────────────────────────────────────────────────────────
  bot.onText(/\/pair(?:\s+(.+))?/, (msg, match) => guard(bot, msg, async (userId) => {
    const phone = (match[1] || '').trim();
    if (!phone) {
      sendBox(bot, msg.chat.id, '🔗 Pair WhatsApp', [
        'Usage: /pair &lt;phone&gt;',
        'Example: /pair +923001234567',
        '',
        '📌 Steps after getting code:',
        '1. Open WhatsApp on your phone',
        '2. Settings → Linked Devices',
        '3. Link a Device',
        '4. "Link with phone number instead"',
        '5. Enter the 8-digit code shown',
      ], [[DEV_BTN]]);
      return;
    }

    const wait = await send(bot, msg.chat.id,
      `⏳ Requesting pairing code for <code>${escHtml(phone)}</code>…\n<i>May take up to 30 seconds.</i>`
    );

    try {
      const { code, waitForConnection } = await requestPairingCode(phone, userId);
      await editBox(bot, msg.chat.id, wait.message_id, '🔑 Pairing Code Ready!',
        [
          `📱 Phone: <code>${escHtml(phone)}</code>`,
          ``,
          `🔐 Your Code:`,
          ``,
          `  <code>${escHtml(code)}</code>`,
          ``,
          `⏱ Expires in ~60 seconds`,
          ``,
          `📌 WhatsApp → Settings`,
          `  → Linked Devices → Link a Device`,
          `  → Link with phone number instead`,
        ],
        [
          [btn('📋 Copy Code', { copy: code, style: 'success', icon: 'copy' })],
          [DEV_BTN],
        ]
      );

      waitForConnection
        .then(async () => {
          db.addSession(userId, { sessionId: `session_${Date.now()}`, phone, status: 'active' });
          await startWhatsAppForUser(userId);
          sendBox(bot, msg.chat.id, '✅ WhatsApp Linked!', [
            `📱 Phone: <code>${escHtml(phone)}</code>`,
            `🟢 Status: Connected`,
            `🔑 OTPs will be forwarded to your added destinations.`,
            ``,
            `Use /addgroup to add forwarding destinations.`,
          ], [
            [btn('➕ Add Group', { cb: 'addgroup_help', style: 'success', icon: 'add' })],
            [btn('📡 Status', { cb: 'status', style: 'primary', icon: 'satellite' })],
            [DEV_BTN],
          ]);
        })
        .catch(err => send(bot, msg.chat.id, `❌ Pairing failed: ${escHtml(err.message)}`));

    } catch (err) {
      edit(bot, msg.chat.id, wait.message_id, `❌ Failed: ${escHtml(err.message)}`);
    }
  }));

  // ── /status ──────────────────────────────────────────────────────────────────
  bot.onText(/\/status/, (msg) => guard(bot, msg, async (userId) => {
    const connected = isConnected(userId);
    const sessDir   = getUserSessionDir(userId);
    let sessFiles   = 0;
    try { sessFiles = (await require('fs-extra').readdir(sessDir).catch(() => [])).length; } catch (_) {}
    const stats  = db.getUserStats(userId);
    const theme  = db.getUserSetting(userId, 'theme') ?? 0;
    const otpOn  = db.getUserSetting(userId, 'otp_enabled');
    const dests  = db.getDestinations(userId);
    const tokens = db.getTokens(userId);

    sendBox(bot, msg.chat.id, '📡 Your Status', [
      `WhatsApp:   ${connected ? '🟢 Connected' : '🔴 Offline'}`,
      `Uptime:     <code>${connected ? formatUptime(getUptime(userId)) : '–'}</code>`,
      `Session:    <code>${sessFiles} file(s)</code>`,
      ``,
      `OTP fwd:    ${otpOn ? '✅ ON' : '🔴 OFF'}`,
      `Theme:      <b>#${theme}</b>`,
      `Dests:      <b>${dests.length}</b>`,
      `Tokens:     <b>${tokens.filter(t => t.status === 'active').length} active / ${tokens.length} total</b>`,
      ``,
      `Your OTPs:  <b>${stats.total}</b>`,
      `Today:      <b>${stats.otpsToday}</b>`,
      `Last hour:  <b>${stats.lastHour}</b>`,
    ], [
      [
        btn('🔄 Restart', { cb: 'restart',    style: 'danger',  icon: 'refresh'   }),
        btn('📊 Stats',   { cb: 'stats',      style: 'success', icon: 'stats'     }),
        btn('📋 Groups',  { cb: 'listgroups', style: 'primary', icon: 'group'     }),
      ],
      [DEV_BTN],
    ]);
  }));

  // ── /restart ─────────────────────────────────────────────────────────────────
  bot.onText(/\/restart/, (msg) => guard(bot, msg, async (userId) => {
    const m = await send(bot, msg.chat.id, '🔄 Restarting your WhatsApp…');
    try {
      await restartWhatsAppForUser(userId);
      editBox(bot, msg.chat.id, m.message_id, '✅ Restarted',
        ['WhatsApp restarted successfully.'],
        [[btn('📡 Status', { cb: 'status', style: 'primary', icon: 'satellite' })], [DEV_BTN]]
      );
    } catch (err) {
      edit(bot, msg.chat.id, m.message_id, `❌ Restart failed: ${escHtml(err.message)}`);
    }
  }));

  // ── /sessions ────────────────────────────────────────────────────────────────
  bot.onText(/\/sessions/, (msg) => guard(bot, msg, (userId) => {
    const sessions = db.getSessions(userId);
    if (!sessions.length) {
      sendBox(bot, msg.chat.id, '📋 Sessions',
        ['No sessions stored.', 'Use /pair to link WhatsApp.'],
        [[btn('🔗 Pair Now', { cb: 'pair_prompt', style: 'success', icon: 'pair' })], [DEV_BTN]]
      );
      return;
    }
    const lines = sessions.flatMap((s, i) => [
      `${i + 1}. <code>${escHtml(s.phone)}</code> [${s.status}]`,
      `   ID: <code>${s.sessionId}</code>`,
      `   Added: ${s.createdAt?.slice(0, 10)}`,
      ``,
    ]);
    const delRows = sessions.map(s =>
      [btn(`🗑 Delete ${s.phone}`, { cb: `delpair_${s.sessionId}`, style: 'danger', icon: 'trash' })]
    );
    sendBox(bot, msg.chat.id, `📋 Sessions (${sessions.length})`, lines, [...delRows, [DEV_BTN]]);
  }));

  // ── /delpair ─────────────────────────────────────────────────────────────────
  bot.onText(/\/delpair(?:\s+(.+))?/, (msg, match) => guard(bot, msg, (userId) => {
    const id = (match[1] || '').trim();
    if (!id) { send(bot, msg.chat.id, 'Usage: /delpair &lt;sessionId&gt;'); return; }
    db.deleteSession(userId, id);
    sendBox(bot, msg.chat.id, '🗑 Session Deleted', [`<code>${escHtml(id)}</code> removed.`], [[DEV_BTN]]);
  }));

  // ── /otp ─────────────────────────────────────────────────────────────────────
  bot.onText(/\/otp(?:\s+(\S+))?/, (msg, match) => guard(bot, msg, (userId) => {
    const sub = (match[1] || '').toLowerCase();
    if (sub === 'on') {
      db.setUserSetting(userId, 'otp_enabled', true);
      sendBox(bot, msg.chat.id, '🔛 OTP Forwarding', ['✅ Enabled.'],
        [[btn('📊 Stats', { cb: 'stats', style: 'success', icon: 'stats' })], [DEV_BTN]]);
    } else if (sub === 'off') {
      db.setUserSetting(userId, 'otp_enabled', false);
      sendBox(bot, msg.chat.id, '🔛 OTP Forwarding', ['🔴 Disabled.'],
        [[btn('✅ Re-enable', { cb: 'otp_on', style: 'success', icon: 'check' })], [DEV_BTN]]);
    } else {
      const st = db.getUserSetting(userId, 'otp_enabled') ? 'ON ✅' : 'OFF 🔴';
      sendBox(bot, msg.chat.id, '🔛 OTP Forwarding',
        [`Current: <b>${st}</b>`, '', 'Usage: /otp on|off'],
        [
          [
            btn('✅ Enable',  { cb: 'otp_on',  style: 'success', icon: 'check'  }),
            btn('🔴 Disable', { cb: 'otp_off', style: 'danger',  icon: 'cancel' }),
          ],
          [DEV_BTN],
        ]
      );
    }
  }));

  // ── /addgroup ────────────────────────────────────────────────────────────────
  bot.onText(/\/addgroup(?:\s+(.+))?/, (msg, match) => guard(bot, msg, async (userId) => {
    const link = (match[1] || '').trim();
    if (!link) {
      sendBox(bot, msg.chat.id, '➕ Add Destination', [
        'Usage: /addgroup &lt;link_or_id&gt;',
        '',
        'WA Group:    https://chat.whatsapp.com/XXXX',
        'WA Channel:  https://whatsapp.com/channel/XXXX',
        'Telegram ID: -1001234567890',
        '',
        '<i>Bot must be admin in the Telegram chat.</i>',
      ], [[DEV_BTN]]);
      return;
    }

    // Telegram chat ID (negative int or large positive int)
    if (/^-?\d+$/.test(link)) {
      const chatId = Number(link);
      try {
        const dest = db.addDestination(userId, { type: 'telegram', chatId, name: `TG Group ${link}` });
        sendBox(bot, msg.chat.id, '✅ Telegram Destination Added',
          [`ID:      <b>${dest.id}</b>`, `ChatID:  <code>${chatId}</code>`, `Type:    Telegram`],
          [[btn('📋 List All', { cb: 'listgroups', style: 'primary', icon: 'group' })], [DEV_BTN]]
        );
      } catch (err) { send(bot, msg.chat.id, `❌ ${escHtml(err.message)}`); }
      return;
    }

    const sock = getSocket(userId);
    if (!sock || !isConnected(userId)) {
      send(bot, msg.chat.id, '❌ WhatsApp not connected. Use /pair first.');
      return;
    }

    const isChannel = /whatsapp\.com\/channel\//i.test(link);
    if (isChannel) {
      const km = link.match(/whatsapp\.com\/channel\/([A-Za-z0-9]+)/);
      if (!km) { send(bot, msg.chat.id, '❌ Invalid channel link.'); return; }
      const m = await send(bot, msg.chat.id, '⏳ Subscribing to channel…');
      try {
        const meta = await sock.newsletterSubscribe(link);
        const jid  = meta?.id || `${km[1]}@newsletter`;
        const name = meta?.name || km[1];
        const dest = db.addDestination(userId, { type: 'whatsappChannel', jid, name });
        editBox(bot, msg.chat.id, m.message_id, '✅ Channel Added',
          [`ID:   <b>${dest.id}</b>`, `Name: ${escHtml(name)}`, `JID:  <code>${escHtml(jid)}</code>`],
          [[btn('📋 List All', { cb: 'listgroups', style: 'primary', icon: 'group' })], [DEV_BTN]]
        );
      } catch (err) { edit(bot, msg.chat.id, m.message_id, `❌ Subscribe failed: ${escHtml(err.message)}`); }
    } else {
      const cm = link.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/);
      if (!cm) { send(bot, msg.chat.id, '❌ Invalid group invite link.'); return; }
      const m = await send(bot, msg.chat.id, '⏳ Joining group…');
      try {
        const gJid = await sock.groupAcceptInvite(cm[1]);
        let name = gJid;
        try { name = (await sock.groupMetadata(gJid))?.subject || gJid; } catch (_) {}
        const dest = db.addDestination(userId, { type: 'whatsapp', jid: gJid, name });
        editBox(bot, msg.chat.id, m.message_id, '✅ Group Added',
          [`ID:   <b>${dest.id}</b>`, `Name: ${escHtml(name)}`, `JID:  <code>${escHtml(gJid)}</code>`],
          [[btn('📋 List All', { cb: 'listgroups', style: 'primary', icon: 'group' })], [DEV_BTN]]
        );
      } catch (err) { edit(bot, msg.chat.id, m.message_id, `❌ Join failed: ${escHtml(err.message)}`); }
    }
  }));

  // ── /delgroup ────────────────────────────────────────────────────────────────
  bot.onText(/\/delgroup(?:\s+(\d+))?/, (msg, match) => guard(bot, msg, (userId) => {
    const id = parseInt(match[1] || '', 10);
    if (isNaN(id)) { send(bot, msg.chat.id, 'Usage: /delgroup &lt;id&gt;'); return; }
    const ok = db.deleteDestination(userId, id);
    sendBox(bot, msg.chat.id,
      ok ? '🗑 Removed' : '❌ Not Found',
      [ok ? `Destination #${id} deleted.` : `No destination with ID ${id}.`],
      [[btn('📋 List All', { cb: 'listgroups', style: 'primary', icon: 'group' })], [DEV_BTN]]
    );
  }));

  // ── /listgroups ──────────────────────────────────────────────────────────────
  bot.onText(/\/listgroups/, (msg) => guard(bot, msg, (userId) => {
    const dests = db.getDestinations(userId);
    if (!dests.length) {
      sendBox(bot, msg.chat.id, '📋 Destinations',
        ['None configured.', 'Use /addgroup &lt;link_or_id&gt; to add one.'],
        [[btn('➕ Add Group', { cb: 'addgroup_help', style: 'success', icon: 'add' })], [DEV_BTN]]
      );
      return;
    }
    const lines = dests.flatMap(d => {
      const loc = d.type === 'telegram'
        ? `ChatID: <code>${d.chatId}</code>`
        : `JID: <code>${escHtml(d.jid)}</code>`;
      return [`#${d.id} [${d.type}] <b>${escHtml(d.name)}</b>`, `   ${loc}`, ``];
    });
    const delRows = dests.map(d =>
      [btn(`🗑 #${d.id} ${d.name.slice(0, 18)}`, { cb: `delgroup_${d.id}`, style: 'danger', icon: 'trash' })]
    );
    sendBox(bot, msg.chat.id, `📋 Destinations (${dests.length})`, lines, [...delRows, [DEV_BTN]]);
  }));

  // ── /addtoken ────────────────────────────────────────────────────────────────
  bot.onText(/\/addtoken(?:\s+(\S+))?/, (msg, match) => guard(bot, msg, async (userId) => {
    const token = (match[1] || '').trim();
    if (!token) {
      sendBox(bot, msg.chat.id, '🔑 Add Secret Token', [
        'Usage: /addtoken &lt;token&gt;',
        '',
        'Get tokens from tempnum.net',
        'Token will require admin approval.',
      ], [[DEV_BTN]]);
      return;
    }

    let tok;
    try {
      tok = db.addToken(userId, token);
    } catch (err) {
      send(bot, msg.chat.id, `❌ ${escHtml(err.message)}`);
      return;
    }

    sendBox(bot, msg.chat.id, '⏳ Token Submitted', [
      `Token: <code>${maskToken(token)}</code>`,
      `Status: <b>Pending approval</b>`,
      `ID: <code>${tok.id}</code>`,
      ``,
      `Admins have been notified.`,
      `You'll be notified once approved.`,
    ], [[btn('📋 My Tokens', { cb: 'mytokens', style: 'primary', icon: 'token' })], [DEV_BTN]]);

    // Notify all superadmins
    const admins = getConfig().telegram?.superadmin_ids || [];
    const userName = msg.from?.username ? `@${msg.from.username}` : msg.from?.first_name || 'Unknown';
    const adminText = `🆕 <b>New Token Request</b>\n\n👤 User: <b>${escHtml(msg.from?.first_name || '')}</b> (${escHtml(userName)}) [ID: <code>${userId}</code>]\n🔑 Token: <code>${maskToken(token)}</code>\n📅 Requested: ${new Date().toISOString().replace('T', ' ').slice(0, 19)}`;
    const adminKb = {
      inline_keyboard: [[
        btn('✅ Approve', { cb: `approve_token_${userId}_${tok.id}`, style: 'success', icon: 'approve' }),
        btn('❌ Reject',  { cb: `reject_token_${userId}_${tok.id}`,  style: 'danger',  icon: 'reject'  }),
      ]],
    };
    for (const adminId of admins) {
      bot.sendMessage(adminId, adminText, { parse_mode: 'HTML', reply_markup: adminKb }).catch(() => {});
    }
  }));

  // ── /mytokens ────────────────────────────────────────────────────────────────
  bot.onText(/\/mytokens/, (msg) => guard(bot, msg, (userId) => {
    const tokens = db.getTokens(userId);
    if (!tokens.length) {
      sendBox(bot, msg.chat.id, '🔑 My Tokens', ['No tokens added.', 'Use /addtoken &lt;token&gt;'],
        [[btn('➕ Add Token', { cb: 'addtoken_help', style: 'success', icon: 'add' })], [DEV_BTN]]
      );
      return;
    }
    const statusEmoji = { pending: '⏳', active: '✅', rejected: '❌' };
    const lines = tokens.flatMap(t => [
      `<code>${t.id}</code>  ${statusEmoji[t.status] || '❓'} <b>${t.status}</b>`,
      `Token: <code>${maskToken(t.token)}</code>`,
      `Added: ${t.addedAt?.slice(0, 10)}`,
      t.lastReceivedAt ? `Last OTP: ${t.lastReceivedAt.slice(0, 19).replace('T', ' ')}` : `Last OTP: –`,
      ``,
    ]);
    const delRows = tokens.map(t =>
      [btn(`🗑 Delete ${t.id}`, { cb: `deltoken_${t.id}`, style: 'danger', icon: 'trash' })]
    );
    sendBox(bot, msg.chat.id, `🔑 My Tokens (${tokens.length})`, lines, [...delRows, [DEV_BTN]]);
  }));

  // ── /deltoken ────────────────────────────────────────────────────────────────
  bot.onText(/\/deltoken(?:\s+(\S+))?/, (msg, match) => guard(bot, msg, (userId) => {
    const tokenId = (match[1] || '').trim();
    if (!tokenId) { send(bot, msg.chat.id, 'Usage: /deltoken &lt;id&gt;'); return; }
    tokenPolling.stopPolling(userId, tokenId);
    const ok = db.deleteToken(userId, tokenId);
    sendBox(bot, msg.chat.id,
      ok ? '🗑 Token Deleted' : '❌ Token Not Found',
      [ok ? `Token <code>${tokenId}</code> removed.` : `No token with that ID.`],
      [[btn('📋 My Tokens', { cb: 'mytokens', style: 'primary', icon: 'token' })], [DEV_BTN]]
    );
  }));

  // ── /stats ────────────────────────────────────────────────────────────────────
  bot.onText(/\/stats/, (msg) => guard(bot, msg, async (userId) => {
    let stats;
    try {
      stats = await fetchPublicStats();
    } catch (_) {
      const u = db.getUserStats(userId);
      sendBox(bot, msg.chat.id, '📊 Your OTP Stats', [
        `⚠️ <i>Could not reach public API.</i>`,
        ``,
        `📦 Your Total:  <b>${u.total}</b>`,
        `📅 Today:       <b>${u.otpsToday}</b>`,
        `⏱ Last hour:   <b>${u.lastHour}</b>`,
      ], [[btn('🔄 Retry', { cb: 'stats', style: 'primary', icon: 'refresh' })], [DEV_BTN]]);
      return;
    }

    const byService = stats.by_service || {};
    const maxSvc    = Math.max(...Object.values(byService), 1);
    const svcLines  = Object.entries(byService)
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([svc, cnt]) => `${svc.padEnd(12)} ${progressBar(cnt, maxSvc, 8)} ${cnt}`);
    const mine = db.getUserStats(userId);

    sendBox(bot, msg.chat.id, '📊 Global OTP Statistics', [
      `🌐 <b>tempnum.net</b>`,
      ``,
      `📦 Total:      <b>${stats.total_otps}</b>`,
      `📅 Today:      <b>${stats.otps_today}</b>`,
      `⏱ Last hour:  <b>${stats.last_hour_otps}</b>`,
      `🕐 Updated:    <code>${stats.generated_at}</code>`,
      ``,
      `── By Service ──────────────`,
      ...svcLines,
      ``,
      `── Your Stats ──────────────`,
      `📦 Your Total: <b>${mine.total}</b>`,
      `📅 Today:      <b>${mine.otpsToday}</b>`,
      `⏱ Last hour:  <b>${mine.lastHour}</b>`,
    ], [
      [
        btn('🔄 Refresh', { cb: 'stats',  style: 'primary', icon: 'refresh' }),
        btn('🕐 Recent',  { cb: 'recent', style: 'primary', icon: 'recent'  }),
      ],
      [DEV_BTN],
    ]);
  }));

  // ── /recent ──────────────────────────────────────────────────────────────────
  bot.onText(/\/recent(?:\s+(\d+))?/, (msg, match) => guard(bot, msg, (userId) => {
    const limit   = Math.min(parseInt(match[1] || '10', 10), 50);
    const history = db.getOtpHistory(userId, limit);
    if (!history.length) {
      sendBox(bot, msg.chat.id, '🕐 Recent OTPs', ['No OTPs recorded yet.'], [[DEV_BTN]]);
      return;
    }
    const PAGE = 5;
    for (let i = 0; i < history.length; i += PAGE) {
      const page  = history.slice(i, i + PAGE);
      const lines = page.flatMap((r, j) => [
        `<b>${i + j + 1}.</b> ${escHtml(r.service)} · <code>${escHtml(r.phoneMasked)}</code>`,
        `   🔑 OTP: <code>${escHtml(r.otp)}</code>`,
        `   🌍 ${escHtml(r.country)} · ${r.receivedAt?.slice(0, 19).replace('T', ' ')}`,
        ``,
      ]);
      const copyRows = page.map((r, j) => [
        btn(`📋 Copy #${i + j + 1}: ${r.otp}`, { copy: r.otp, style: 'success', icon: 'copy' }),
      ]);
      sendBox(bot, msg.chat.id,
        `🕐 Recent OTPs (${Math.floor(i / PAGE) + 1}/${Math.ceil(history.length / PAGE)})`,
        lines,
        [...copyRows, [DEV_BTN]]
      );
    }
  }));

  // ── /settheme ────────────────────────────────────────────────────────────────
  bot.onText(/\/settheme(?:\s+(\d+))?/, (msg, match) => guard(bot, msg, (userId) => {
    const id  = parseInt(match[1] ?? '-1', 10);
    const cur = db.getUserSetting(userId, 'theme') ?? 0;
    if (isNaN(id) || id < 0 || id > 14) {
      sendBox(bot, msg.chat.id, '🎨 OTP Themes',
        [...THEME_NAMES, '', `Current: <b>#${cur}</b>`, 'Tap a number to switch:'],
        [
          [0,1,2,3,4].map(n => btn(`${n}`, { cb: `theme_${n}`, style: n === cur ? 'success' : 'primary' })),
          [5,6,7,8,9].map(n => btn(`${n}`, { cb: `theme_${n}`, style: n === cur ? 'success' : 'primary' })),
          [10,11,12,13,14].map(n => btn(`${n}`, { cb: `theme_${n}`, style: n === cur ? 'success' : 'primary' })),
          [DEV_BTN],
        ]
      );
      return;
    }
    db.setUserSetting(userId, 'theme', id);
    sendBox(bot, msg.chat.id, '🎨 Theme Updated',
      [`Active: <b>#${id}</b> – ${THEME_NAMES[id]}`, '', 'Applies to both Telegram and WhatsApp destinations.'],
      [
        [0,1,2,3,4].map(n => btn(`${n}`, { cb: `theme_${n}`, style: n === id ? 'success' : 'primary' })),
        [5,6,7,8,9].map(n => btn(`${n}`, { cb: `theme_${n}`, style: n === id ? 'success' : 'primary' })),
        [10,11,12,13,14].map(n => btn(`${n}`, { cb: `theme_${n}`, style: n === id ? 'success' : 'primary' })),
        [DEV_BTN],
      ]
    );
  }));

  // ── /clearhistory ────────────────────────────────────────────────────────────
  bot.onText(/\/clearhistory/, (msg) => guard(bot, msg, (userId) => {
    db.clearOtpHistory(userId);
    sendBox(bot, msg.chat.id, '🗑 History Cleared', ['Your OTP history has been wiped.'],
      [[btn('📊 Stats', { cb: 'stats', style: 'primary', icon: 'stats' })], [DEV_BTN]]);
  }));

  // ── /menu & /help ─────────────────────────────────────────────────────────────
  function showMenu(msg) {
    guard(bot, msg, (userId) => {
      const cfg = getConfig();
      sendBox(bot, msg.chat.id,
        `🤖 ${escHtml(cfg.bot?.name || 'Sigma OTP Manager')} — Commands`,
        [
          '🔗 /pair &lt;phone&gt;       – Link WhatsApp',
          '📡 /status              – Connection status',
          '🔄 /restart             – Restart WhatsApp',
          '📋 /sessions            – List sessions',
          '🗑  /delpair &lt;id&gt;      – Delete session',
          '📊 /stats               – Global OTP stats',
          '🕐 /recent [n]          – Your recent OTPs',
          '🎨 /settheme [0-14]     – Change OTP theme',
          '🔛 /otp on|off          – Toggle OTP fwd',
          '➕ /addgroup &lt;link|id&gt; – Add destination',
          '➖ /delgroup &lt;id&gt;      – Remove destination',
          '📋 /listgroups          – List destinations',
          '🔑 /addtoken &lt;token&gt;  – Add secret token',
          '📋 /mytokens            – My tokens',
          '🗑  /deltoken &lt;id&gt;     – Delete token',
          '🗑  /clearhistory        – Clear OTP history',
          '📢 /broadcast &lt;msg&gt;    – Superadmin only',
          '❓ /help                – This menu',
        ],
        [
          [
            btn('📊 Stats',   { cb: 'stats',      style: 'success', icon: 'stats'     }),
            btn('📡 Status',  { cb: 'status',     style: 'primary', icon: 'satellite' }),
            btn('🔄 Restart', { cb: 'restart',    style: 'danger',  icon: 'refresh'   }),
          ],
          [
            btn('🎨 Themes',  { cb: 'themes',     style: 'primary', icon: 'theme'     }),
            btn('📋 Groups',  { cb: 'listgroups', style: 'primary', icon: 'group'     }),
            btn('🔑 Tokens',  { cb: 'mytokens',   style: 'primary', icon: 'token'     }),
          ],
          [
            btn('✅ OTP ON',  { cb: 'otp_on',  style: 'success', icon: 'check'  }),
            btn('🔴 OTP OFF', { cb: 'otp_off', style: 'danger',  icon: 'cancel' }),
          ],
          [DEV_BTN],
        ]
      );
    });
  }
  bot.onText(/\/menu/, showMenu);
  bot.onText(/\/help/, showMenu);

  // ── Admin commands ────────────────────────────────────────────────────────────

  bot.onText(/\/admin/, (msg) => adminGuard(bot, msg, (userId) => {
    const allUsers   = db.getAllUserIds().length;
    const pending    = db.getAllPendingTokens().length;
    const gs         = db.getGlobalStats();
    sendBox(bot, msg.chat.id, '🛡 Admin Panel', [
      `👥 Total users:     <b>${allUsers}</b>`,
      `📦 OTPs forwarded:  <b>${gs.total_otps_forwarded}</b>`,
      `🔑 Total tokens:    <b>${gs.total_tokens}</b>`,
      `⏳ Pending approvals: <b>${pending}</b>`,
    ], [
      [
        btn('👥 Users',   { cb: 'admin_listusers',  style: 'primary', icon: 'users'    }),
        btn('⏳ Pending', { cb: 'admin_pending',    style: 'warn',    icon: 'warn'     }),
        btn('📢 Broadcast',{ cb: 'admin_broadcast', style: 'primary', icon: 'mega'     }),
      ],
      [DEV_BTN],
    ]);
  }));

  bot.onText(/\/listusers/, (msg) => adminGuard(bot, msg, () => {
    const uids = db.getAllUserIds();
    const lines = uids.slice(0, 30).map((uid, i) => {
      const u  = db.getUserData(uid);
      const st = u.sessions?.length ? '🟢' : '🔴';
      return `${i + 1}. ${st} <code>${uid}</code> – OTPs: ${u.otpHistory?.length || 0}`;
    });
    sendBox(bot, msg.chat.id, `👥 Users (${uids.length})`, lines.length ? lines : ['No users yet.'], [[DEV_BTN]]);
  }));

  bot.onText(/\/viewuser(?:\s+(\d+))?/, (msg, match) => adminGuard(bot, msg, () => {
    const uid = (match[1] || '').trim();
    if (!uid) { send(bot, msg.chat.id, 'Usage: /viewuser &lt;userId&gt;'); return; }
    const u = db.getUserData(uid);
    sendBox(bot, msg.chat.id, `👤 User ${uid}`, [
      `Sessions:  <b>${u.sessions?.length || 0}</b>`,
      `Dests:     <b>${u.forwardDestinations?.length || 0}</b>`,
      `Tokens:    <b>${u.tokens?.length || 0}</b>`,
      `OTPs:      <b>${u.otpHistory?.length || 0}</b>`,
      `OTP On:    <b>${u.settings?.otp_enabled ? '✅' : '❌'}</b>`,
      `Theme:     <b>#${u.settings?.theme ?? 0}</b>`,
      `Reg:       <code>${u.registeredAt?.slice(0, 10)}</code>`,
    ], [[DEV_BTN]]);
  }));

  bot.onText(/\/deluser(?:\s+(\d+))?/, (msg, match) => adminGuard(bot, msg, () => {
    const uid = (match[1] || '').trim();
    if (!uid) { send(bot, msg.chat.id, 'Usage: /deluser &lt;userId&gt;'); return; }
    tokenPolling.stopAllForUser(uid);
    const data = db.getUserData(uid);
    data.sessions            = [];
    data.forwardDestinations = [];
    data.tokens              = [];
    data.otpHistory          = [];
    db.saveUserData(uid, data);
    send(bot, msg.chat.id, `✅ User <code>${uid}</code> data cleared.`, { parse_mode: 'HTML' });
  }));

  bot.onText(/\/listpending/, (msg) => adminGuard(bot, msg, () => {
    const pending = db.getAllPendingTokens();
    if (!pending.length) { send(bot, msg.chat.id, '✅ No pending token requests.'); return; }
    const rows = [];
    const lines = pending.flatMap(({ userId, token: t }) => {
      rows.push([
        btn('✅ Approve', { cb: `approve_token_${userId}_${t.id}`, style: 'success', icon: 'approve' }),
        btn('❌ Reject',  { cb: `reject_token_${userId}_${t.id}`,  style: 'danger',  icon: 'reject'  }),
      ]);
      return [
        `User: <code>${userId}</code>  ID: <code>${t.id}</code>`,
        `Token: <code>${maskToken(t.token)}</code>`,
        ``,
      ];
    });
    sendBox(bot, msg.chat.id, `⏳ Pending (${pending.length})`, lines, [...rows, [DEV_BTN]]);
  }));

  bot.onText(/\/approvetoken(?:\s+(\S+))?(?:\s+(\S+))?/, (msg, match) => adminGuard(bot, msg, () => {
    const [userId, tokenId] = [match[1], match[2]];
    if (!userId || !tokenId) { send(bot, msg.chat.id, 'Usage: /approvetoken &lt;userId&gt; &lt;tokenId&gt;'); return; }
    _approveToken(bot, userId, tokenId, msg.chat.id);
  }));

  bot.onText(/\/rejecttoken(?:\s+(\S+))?(?:\s+(\S+))?/, (msg, match) => adminGuard(bot, msg, () => {
    const [userId, tokenId] = [match[1], match[2]];
    if (!userId || !tokenId) { send(bot, msg.chat.id, 'Usage: /rejecttoken &lt;userId&gt; &lt;tokenId&gt;'); return; }
    _rejectToken(bot, userId, tokenId, msg.chat.id);
  }));

  bot.onText(/\/settheme_global(?:\s+(\d+))?/, (msg, match) => adminGuard(bot, msg, () => {
    const id = parseInt(match[1] ?? '', 10);
    if (isNaN(id) || id < 0 || id > 14) { send(bot, msg.chat.id, 'Usage: /settheme_global &lt;0-14&gt;'); return; }
    const uids = db.getAllUserIds();
    for (const uid of uids) db.setUserSetting(uid, 'theme', id);
    send(bot, msg.chat.id, `✅ Global theme set to <b>#${id}</b> for ${uids.length} users.`, { parse_mode: 'HTML' });
  }));

  bot.onText(/\/broadcast(?:\s+([\s\S]+))?/, (msg, match) => adminGuard(bot, msg, async () => {
    const text = (match[1] || '').trim();
    if (!text) { send(bot, msg.chat.id, 'Usage: /broadcast &lt;message&gt;'); return; }
    const users = db.getAllUserIds();
    let sent = 0, failed = 0;
    for (const uid of users) {
      try { await bot.sendMessage(uid, `📢 <b>Broadcast</b>\n\n${escHtml(text)}`, { parse_mode: 'HTML' }); sent++; }
      catch (_) { failed++; }
    }
    sendBox(bot, msg.chat.id, '📢 Broadcast Done',
      [`✅ Sent:   <b>${sent}</b>`, `❌ Failed: <b>${failed}</b>`, `👥 Total:  <b>${users.length}</b>`],
      [[DEV_BTN]]
    );
  }));

  bot.onText(/\/restart_bot/, (msg) => adminGuard(bot, msg, () => {
    send(bot, msg.chat.id, '🔄 Restarting bot process…');
    setTimeout(() => process.exit(0), 1000);
  }));

  // ── Callback query handler ────────────────────────────────────────────────────
  bot.on('callback_query', (query) => {
    const msg    = query.message;
    const data   = query.data || '';
    const userId = query.from.id;
    bot.answerCallbackQuery(query.id).catch(() => {});

    const fakeMsg = { ...msg, from: query.from };

    if (data === 'menu')           { showMenu(fakeMsg); return; }
    if (data === 'stats')          { bot.emit('text', { ...fakeMsg, text: '/stats' }); return; }
    if (data === 'status')         { bot.emit('text', { ...fakeMsg, text: '/status' }); return; }
    if (data === 'listgroups')     { bot.emit('text', { ...fakeMsg, text: '/listgroups' }); return; }
    if (data === 'themes')         { bot.emit('text', { ...fakeMsg, text: '/settheme' }); return; }
    if (data === 'recent')         { bot.emit('text', { ...fakeMsg, text: '/recent' }); return; }
    if (data === 'addgroup_help')  { bot.emit('text', { ...fakeMsg, text: '/addgroup' }); return; }
    if (data === 'pair_prompt')    { bot.emit('text', { ...fakeMsg, text: '/pair' }); return; }
    if (data === 'mytokens')       { bot.emit('text', { ...fakeMsg, text: '/mytokens' }); return; }
    if (data === 'addtoken_help')  { bot.emit('text', { ...fakeMsg, text: '/addtoken' }); return; }
    if (data === 'admin_listusers'){ bot.emit('text', { ...fakeMsg, text: '/listusers' }); return; }
    if (data === 'admin_pending')  { bot.emit('text', { ...fakeMsg, text: '/listpending' }); return; }

    if (data === 'otp_on') {
      db.setUserSetting(userId, 'otp_enabled', true);
      bot.sendMessage(msg.chat.id, '✅ OTP forwarding <b>enabled</b>.', { parse_mode: 'HTML' }).catch(() => {});
      return;
    }
    if (data === 'otp_off') {
      db.setUserSetting(userId, 'otp_enabled', false);
      bot.sendMessage(msg.chat.id, '🔴 OTP forwarding <b>disabled</b>.', { parse_mode: 'HTML' }).catch(() => {});
      return;
    }

    if (data === 'restart') {
      bot.sendMessage(msg.chat.id, '🔄 Restarting your WhatsApp…').then(m => {
        restartWhatsAppForUser(userId)
          .then(() => edit(bot, msg.chat.id, m.message_id, '✅ WhatsApp restarted.'))
          .catch(err => edit(bot, msg.chat.id, m.message_id, `❌ ${escHtml(err.message)}`));
      }).catch(() => {});
      return;
    }

    if (data.startsWith('theme_')) {
      const id = parseInt(data.split('_')[1], 10);
      if (!isNaN(id) && id >= 0 && id <= 14) {
        db.setUserSetting(userId, 'theme', id);
        bot.sendMessage(msg.chat.id, `✅ Theme set to <b>#${id}</b> – ${THEME_NAMES[id]}`, { parse_mode: 'HTML' }).catch(() => {});
      }
      return;
    }

    if (data.startsWith('delpair_')) {
      const sessionId = data.slice('delpair_'.length);
      db.deleteSession(userId, sessionId);
      bot.sendMessage(msg.chat.id, `🗑 Session <code>${escHtml(sessionId)}</code> deleted.`, { parse_mode: 'HTML' }).catch(() => {});
      return;
    }

    if (data.startsWith('delgroup_')) {
      const id = parseInt(data.split('_')[1], 10);
      const ok = db.deleteDestination(userId, id);
      bot.sendMessage(msg.chat.id, ok ? `🗑 Destination #${id} deleted.` : `❌ No destination #${id}.`).catch(() => {});
      return;
    }

    if (data.startsWith('deltoken_')) {
      const tokenId = data.slice('deltoken_'.length);
      tokenPolling.stopPolling(userId, tokenId);
      const ok = db.deleteToken(userId, tokenId);
      bot.sendMessage(msg.chat.id, ok ? `🗑 Token deleted.` : `❌ Token not found.`).catch(() => {});
      return;
    }

    // Admin approval callbacks
    if (data.startsWith('approve_token_')) {
      if (!isSuperAdmin(userId)) return;
      const parts   = data.split('_');
      const tUserId = parts[2];
      const tokenId = parts[3];
      _approveToken(bot, tUserId, tokenId, msg.chat.id);
      return;
    }
    if (data.startsWith('reject_token_')) {
      if (!isSuperAdmin(userId)) return;
      const parts   = data.split('_');
      const tUserId = parts[2];
      const tokenId = parts[3];
      _rejectToken(bot, tUserId, tokenId, msg.chat.id);
      return;
    }
  });

  bot.on('polling_error', err => console.error(chalk.red('[TG] polling:'), err.message));
  bot.on('error',         err => console.error(chalk.red('[TG] error:'),   err.message));

  return bot;
}

// ─── Token approval helpers ───────────────────────────────────────────────────
function _approveToken(bot, userId, tokenId, adminChatId) {
  const ok = db.updateTokenStatus(userId, tokenId, 'active');
  if (!ok) {
    bot.sendMessage(adminChatId, `❌ Token not found: <code>${tokenId}</code>`, { parse_mode: 'HTML' }).catch(() => {});
    return;
  }
  tokenPolling.startPolling(userId, tokenId);
  bot.sendMessage(adminChatId, `✅ Token <code>${tokenId}</code> for user <code>${userId}</code> approved.`, { parse_mode: 'HTML' }).catch(() => {});
  bot.sendMessage(userId,
    `✅ <b>Token Approved!</b>\n\nYour token has been approved and is now active.\nOTPs will be forwarded to your added destinations.`,
    { parse_mode: 'HTML' }
  ).catch(() => {});
}

function _rejectToken(bot, userId, tokenId, adminChatId) {
  const ok = db.updateTokenStatus(userId, tokenId, 'rejected');
  if (!ok) {
    bot.sendMessage(adminChatId, `❌ Token not found: <code>${tokenId}</code>`, { parse_mode: 'HTML' }).catch(() => {});
    return;
  }
  bot.sendMessage(adminChatId, `❌ Token <code>${tokenId}</code> for user <code>${userId}</code> rejected.`, { parse_mode: 'HTML' }).catch(() => {});
  bot.sendMessage(userId,
    `❌ <b>Token Rejected</b>\n\nYour token request was rejected by an admin.\nContact @NONEXPERTCODER for help.`,
    { parse_mode: 'HTML' }
  ).catch(() => {});
}

module.exports = { createTelegramBot };