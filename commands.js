'use strict';

/**
 * commands.js  –  v5  (Sigma OTP Manager)
 * WhatsApp in-chat commands. Only processes messages sent by the account owner.
 *
 * Commands (prefix from user settings, default "."):
 *   .otp on|off        – toggle OTP forwarding
 *   .addgroup <link>   – add WA group/channel or Telegram chat ID
 *   .addjid <jid>      – add already-joined destination by JID
 *   .delgroup <id>     – remove destination
 *   .listgroups        – list destinations
 *   .getid             – show current chat JID
 *   .stats             – personal OTP stats
 *   .recent [n]        – last N OTPs
 *   .ping              – liveness check
 *   .status            – connection status
 *   .theme [0-14]      – show/set OTP theme
 *   .clearhistory      – wipe OTP history
 *   .help              – list commands
 */

const chalk = require('chalk');
const db    = require('./database');
const { formatUptime } = require('./utils');

const THEME_NAMES = [
  '0 Classic ⭐','1 Minimal 🎯','2 Developer 👨‍💻','3 Electric ⚡',
  '4 Tech 🔬','5 Premium 💎','6 Ultraminimal 🎲','7 Business 💼',
  '8 Social 🌐','9 Deluxe 🌟','10 Elegance 📝','11 Rainbow 🌈',
  '12 Focus 🎯','13 Royal 👑','14 Luxury 🚁',
];

const isChannelLink = (l) => /whatsapp\.com\/channel\//i.test(l);
const groupCode     = (l) => l.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/)?.[1] || null;
const channelKey    = (l) => l.match(/whatsapp\.com\/channel\/([A-Za-z0-9]+)/)?.[1] || null;

async function handleCommand(sock, msg, body, uptimes) {
  const userId = sock.userId;
  if (!userId) return false;

  const prefix = db.getUserSetting(userId, 'command_prefix') || '.';
  if (!body || !body.startsWith(prefix)) return false;
  if (!msg.key?.fromMe) return false;  // owner only

  const chatJid = msg.key.remoteJid;
  const raw     = body.slice(prefix.length).trim();
  const parts   = raw.split(/\s+/);
  const cmd     = (parts[0] || '').toLowerCase();
  const args    = parts.slice(1);

  const reply = (text) =>
    sock.sendMessage(chatJid, { text }, { quoted: msg })
        .catch(e => console.error(chalk.red(`[cmd:${userId}]`), e.message));

  try {
    switch (cmd) {

      case 'otp': {
        const sub = (args[0] || '').toLowerCase();
        if (sub === 'on')       { db.setUserSetting(userId, 'otp_enabled', true);  await reply('✅ OTP forwarding *enabled*.'); }
        else if (sub === 'off') { db.setUserSetting(userId, 'otp_enabled', false); await reply('🔴 OTP forwarding *disabled*.'); }
        else {
          const st = db.getUserSetting(userId, 'otp_enabled') ? 'ON ✅' : 'OFF 🔴';
          await reply(`OTP forwarding: *${st}*\nUsage: ${prefix}otp on|off`);
        }
        break;
      }

      case 'addgroup': {
        const link = args[0] || '';
        if (!link) {
          await reply(
            `Usage: ${prefix}addgroup <link>\n` +
            `WA Group:   https://chat.whatsapp.com/XXXX\n` +
            `WA Channel: https://whatsapp.com/channel/XXXX\n` +
            `Telegram:   -1001234567890  (numeric chat ID)`
          );
          break;
        }

        // Telegram chat ID (numeric, can be negative)
        if (/^-?\d+$/.test(link)) {
          const chatId = Number(link);
          try {
            const dest = db.addDestination(userId, { type: 'telegram', chatId, name: `TG:${link}` });
            await reply(`✅ *Telegram destination added!*\nID: ${dest.id}\nChat ID: \`${chatId}\``);
          } catch (err) { await reply(`❌ ${err.message}`); }
          break;
        }

        if (isChannelLink(link)) {
          const key = channelKey(link);
          if (!key) { await reply('❌ Invalid channel link.'); break; }
          await reply('⏳ Subscribing to channel…');
          try {
            const meta = await sock.newsletterSubscribe(link);
            const jid  = meta?.id || `${key}@newsletter`;
            const name = meta?.name || key;
            const dest = db.addDestination(userId, { type: 'whatsappChannel', jid, name });
            await reply(`✅ *Channel added!*\nID: ${dest.id}\nName: ${name}\nJID: \`${jid}\``);
          } catch (err) { await reply(`❌ Subscribe failed: ${err.message}`); }
        } else {
          const code = groupCode(link);
          if (!code) { await reply('❌ Invalid group invite link.'); break; }
          await reply('⏳ Joining group…');
          try {
            const gJid = await sock.groupAcceptInvite(code);
            let name = gJid;
            try { name = (await sock.groupMetadata(gJid))?.subject || gJid; } catch (_) {}
            const dest = db.addDestination(userId, { type: 'whatsapp', jid: gJid, name });
            await reply(`✅ *Group joined & added!*\nID: ${dest.id}\nName: ${name}\nJID: \`${gJid}\``);
          } catch (err) {
            if (/already/i.test(err.message)) await reply(`⚠️ Already a member.\nUse ${prefix}addjid <jid> to add manually.`);
            else await reply(`❌ Join failed: ${err.message}`);
          }
        }
        break;
      }

      case 'addjid': {
        const jid  = args[0] || '';
        const name = args.slice(1).join(' ') || jid;
        if (!jid) { await reply(`Usage: ${prefix}addjid <jid> [name]`); break; }
        const type = jid.endsWith('@newsletter') ? 'whatsappChannel' : 'whatsapp';
        try {
          const dest = db.addDestination(userId, { type, jid, name });
          await reply(`✅ *Added!*\nID: ${dest.id}\nName: ${name}\nType: ${type}`);
        } catch (err) { await reply(`❌ ${err.message}`); }
        break;
      }

      case 'delgroup': {
        const id = parseInt(args[0], 10);
        if (isNaN(id)) { await reply(`Usage: ${prefix}delgroup <id>`); break; }
        const ok = db.deleteDestination(userId, id);
        await reply(ok ? `✅ Destination #${id} removed.` : `❌ No destination with ID ${id}.`);
        break;
      }

      case 'listgroups': {
        const dests = db.getDestinations(userId);
        if (!dests.length) { await reply(`📋 No destinations.\nUse ${prefix}addgroup <link>`); break; }
        const lines = dests.map(d => {
          const loc = d.type === 'telegram' ? `ChatID: ${d.chatId}` : `JID: \`${d.jid}\``;
          return `#${d.id} [${d.type}] *${d.name}*\n   ${loc}`;
        });
        await reply(`📋 *Forwarding Destinations* (${dests.length})\n\n${lines.join('\n\n')}`);
        break;
      }

      case 'getid': {
        await reply(`📌 *Chat JID:*\n\`${chatJid}\``);
        break;
      }

      case 'stats': {
        const st = db.getUserStats(userId);
        const svcLines = Object.entries(st.byService || {})
          .sort((a, b) => b[1] - a[1]).slice(0, 6)
          .map(([svc, cnt]) => `  • ${svc}: ${cnt}`).join('\n');
        await reply(
          `📊 *Your OTP Statistics*\n\n` +
          `Total:     ${st.total}\n` +
          `Today:     ${st.otpsToday}\n` +
          `Last hour: ${st.lastHour}\n\n` +
          `*By Service:*\n${svcLines || '  (none yet)'}`
        );
        break;
      }

      case 'recent': {
        const n   = Math.min(parseInt(args[0] || '5', 10), 20);
        const his = db.getOtpHistory(userId, n);
        if (!his.length) { await reply('📭 No OTPs recorded yet.'); break; }
        const lines = his.map((r, i) =>
          `${i + 1}. *${r.service}* · ${r.phoneMasked}\n   OTP: \`${r.otp}\`\n   ${r.receivedAt?.slice(0, 19).replace('T', ' ')}`
        );
        await reply(`🕐 *Last ${his.length} OTPs*\n\n${lines.join('\n\n')}`);
        break;
      }

      case 'ping': {
        const t = Date.now();
        await reply(`🏓 Pong! *${Date.now() - t}ms*`);
        break;
      }

      case 'status': {
        const startTime = uptimes?.get(String(userId));
        const up        = startTime ? formatUptime(Date.now() - startTime) : '–';
        const otpSt     = db.getUserSetting(userId, 'otp_enabled') ? 'ON ✅' : 'OFF 🔴';
        const dests     = db.getDestinations(userId).length;
        const theme     = db.getUserSetting(userId, 'theme') ?? 0;
        await reply(
          `📡 *Status*\n\n` +
          `Connection:   🟢 Connected\n` +
          `Uptime:       ${up}\n` +
          `OTP fwd:      ${otpSt}\n` +
          `Destinations: ${dests}\n` +
          `Theme:        #${theme}\n` +
          `Prefix:       \`${prefix}\``
        );
        break;
      }

      case 'theme': {
        const id = parseInt(args[0] ?? '', 10);
        if (isNaN(id)) {
          const cur = db.getUserSetting(userId, 'theme') ?? 0;
          await reply(`🎨 *OTP Themes*\n\n${THEME_NAMES.join('\n')}\n\nCurrent: #${cur}\nUsage: ${prefix}theme <0-14>`);
        } else if (id < 0 || id > 14) {
          await reply('❌ Theme ID must be 0–14.');
        } else {
          db.setUserSetting(userId, 'theme', id);
          await reply(`✅ Theme set to *#${id}* – ${THEME_NAMES[id]}`);
        }
        break;
      }

      case 'clearhistory': {
        db.clearOtpHistory(userId);
        await reply('🗑 OTP history cleared.');
        break;
      }

      case 'help': {
        const p = prefix;
        await reply(
          `🤖 *Sigma OTP Manager – Commands*\n\n` +
          `${p}otp on|off        – Toggle OTP forwarding\n` +
          `${p}addgroup <link>   – Add WA group/channel or TG chat ID\n` +
          `${p}addjid <jid>      – Add by JID directly\n` +
          `${p}delgroup <id>     – Remove destination\n` +
          `${p}listgroups        – List destinations\n` +
          `${p}getid             – Show chat JID\n` +
          `${p}stats             – Your OTP statistics\n` +
          `${p}recent [n]        – Last N OTPs\n` +
          `${p}ping              – Liveness check\n` +
          `${p}status            – Connection status\n` +
          `${p}theme [0-14]      – Show/set OTP theme\n` +
          `${p}clearhistory      – Wipe OTP history\n` +
          `${p}help              – This message`
        );
        break;
      }

      default: break;
    }
  } catch (err) {
    console.error(chalk.red(`[cmd:${userId}] error:`), err.message);
    await reply(`❌ Error: ${err.message}`);
  }

  return true;
}

module.exports = { handleCommand };