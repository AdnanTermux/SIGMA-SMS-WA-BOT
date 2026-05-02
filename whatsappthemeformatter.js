'use strict';

/**
 * whatsappThemeFormatter.js  –  v1  (Sigma OTP Manager)
 *
 * 15 WhatsApp-compatible OTP themes.
 * Rules:
 *   - NO HTML, NO <tg-emoji> tags
 *   - Static Unicode emojis only
 *   - WhatsApp markdown: *bold*, _italic_, `code`, ~strikethrough~
 *   - Every theme ends with: ✨ Developed by Sigma Adnan ✨
 */

function ts() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

/**
 * @param {number} themeId   0–14
 * @param {string} number    masked phone
 * @param {string} otp       extracted code
 * @param {string} body      original message (truncated)
 * @param {string} service   detected service
 * @param {string} country   country name
 * @param {string} flag      flag emoji
 * @param {string} panel     bot name
 * @returns {string}         Plain text for WhatsApp
 */
function buildWhatsAppOtpMessage(themeId, number, otp, body, service, country, flag, panel) {
  const id  = Math.min(Math.max(Number(themeId) || 0, 0), 14);
  const num = number  || '•••••••••••';
  const code = otp    || '??????';
  const msg  = (body  || '').slice(0, 200);
  const svc  = service || 'Unknown';
  const cty  = country || 'Unknown';
  const fl   = flag   || '🌍';
  const pnl  = panel  || 'Sigma OTP Manager';
  const now  = ts();
  const SIG  = '\n✨ Developed by Sigma Adnan ✨';

  switch (id) {

    // ── 0 · Classic ⭐ ────────────────────────────────────────────────────────
    case 0: return `╔══════════════════════════════╗
   *${pnl}*
╚══════════════════════════════╝

🌍 *Service:* ${svc}
📱 *Number:* ${num}
📍 *Country:* ${cty} ${fl}
🕐 *Time:* ${now}

──────────────────────────────
🔑 *OTP CODE:*
  \`${code}\`
──────────────────────────────
💬 *Message:* _${msg}_
${SIG}`;

    // ── 1 · Minimal 🎯 ────────────────────────────────────────────────────────
    case 1: return `🎯 *OTP · ${svc}*

\`${code}\`

📱 ${num}  ${fl} ${cty}
${SIG}`;

    // ── 2 · Developer 👨‍💻 ──────────────────────────────────────────────────────
    case 2: return `🤖 *[ ${pnl} ]*
\`\`\`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SERVICE  >>  ${svc.slice(0, 18).padEnd(18)}
NUMBER   >>  ${num.slice(0, 18).padEnd(18)}
COUNTRY  >>  ${(fl + ' ' + cty).slice(0, 18).padEnd(18)}
TIME     >>  ${now.slice(11, 19).padEnd(18)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OTP      >>  ${code.padEnd(18)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
\`\`\`
${SIG}`;

    // ── 3 · Electric ⚡ ───────────────────────────────────────────────────────
    case 3: return `⚡⚡ *INCOMING OTP* ⚡⚡
⚡━━━━━━━━━━━━━━━━━━━━━━━━━━⚡

⚡ *Service:*  ${svc}
⚡ *Number:*   ${num}
⚡ *Country:*  ${fl} ${cty}

⚡━━━━━━━━━━━━━━━━━━━━━━━━━━⚡
🔥 *CODE:*  \`${code}\`
⚡━━━━━━━━━━━━━━━━━━━━━━━━━━⚡
${SIG}`;

    // ── 4 · Tech 🔬 ───────────────────────────────────────────────────────────
    case 4: return `📡 *TECH PANEL · ${pnl}*

\`\`\`
┌──────────────────────────┐
│ SVC  : ${svc.slice(0, 18).padEnd(18)} │
│ NUM  : ${num.slice(0, 18).padEnd(18)} │
│ CTY  : ${(fl + ' ' + cty).slice(0, 18).padEnd(18)} │
│ TIME : ${now.slice(11, 19).padEnd(18)} │
├──────────────────────────┤
│ OTP  : ${code.padEnd(18)} │
└──────────────────────────┘
\`\`\`
${SIG}`;

    // ── 5 · Premium 💎 ────────────────────────────────────────────────────────
    case 5: return `💎 ◈━━━━━━━━━━━━━━━━━━━━━━━◈ 💎
        ✦ *PREMIUM OTP* ✦
💎 ◈━━━━━━━━━━━━━━━━━━━━━━━◈ 💎

💎 *Service*   ${svc}
💎 *Number*    ${num}
💎 *Country*   ${fl} ${cty}
💎 *Time*      ${now}

💎 ◈━━━━━━━━━━━━━━━━━━━━━━━◈ 💎
💎 *OTP CODE*

  \`${code}\`

💎 ◈━━━━━━━━━━━━━━━━━━━━━━━◈ 💎
${SIG}`;

    // ── 6 · Ultraminimal 🎲 ───────────────────────────────────────────────────
    case 6: return `\`${code}\`  _${svc}_
${SIG}`;

    // ── 7 · Business 💼 ───────────────────────────────────────────────────────
    case 7: return `╔══════════════════════════════╗
  📄 *OTP VERIFICATION*
╚══════════════════════════════╝

📄 *Service:*     ${svc}
📱 *Account:*     ${num}
🌍 *Region:*      ${fl} ${cty}
🕐 *Timestamp:*   ${now}

▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸
🔒 *Auth Code:*  \`${code}\`
◂◂◂◂◂◂◂◂◂◂◂◂◂◂◂◂◂◂◂◂◂◂◂◂◂◂◂◂◂◂

_Issued by ${pnl}_
${SIG}`;

    // ── 8 · Social 🌐 ─────────────────────────────────────────────────────────
    case 8: return `🌐 *Social OTP Alert* 📢
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌐 *Platform:*  ${svc}
📱 *Number:*    ${num}
${fl} *Country:*   ${cty}
🕐 *Time:*      ${now}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔑 *Your Code:*

  \`${code}\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_Powered by ${pnl}_
${SIG}`;

    // ── 9 · Deluxe 🌟 ─────────────────────────────────────────────────────────
    case 9: return `✨⭐ *DELUXE OTP NOTIFICATION* ⭐✨
══════════════════════════════════

📱 *Number:*   ${num}
🌍 *Country:*  ${fl} ${cty}
📡 *Service:*  ${svc}
🕐 *Time:*     ${now}

══════════════════════════════════
🔑 *OTP CODE*

  \`${code}\`

══════════════════════════════════
💬 *Original Message:*
_${msg}_
══════════════════════════════════
_🤖 ${pnl}_
${SIG}`;

    // ── 10 · Elegance 📝 ──────────────────────────────────────────────────────
    case 10: return `\`\`\`
╔══════════════════════════════╗
║  ✦  ${pnl.slice(0, 22).padEnd(22)}  ✦  ║
╠══════════════════════════════╣
║  Service : ${svc.slice(0, 18).padEnd(18)} ║
║  Number  : ${num.slice(0, 18).padEnd(18)} ║
║  Country : ${(fl + ' ' + cty).slice(0, 18).padEnd(18)} ║
║  Time    : ${now.slice(11, 19).padEnd(18)} ║
╠══════════════════════════════╣
║  OTP     : ${code.padEnd(18)} ║
╚══════════════════════════════╝
\`\`\`
${SIG}`;

    // ── 11 · Rainbow 🌈 ───────────────────────────────────────────────────────
    case 11: return `🌈 🔴🟠🟡🟢🔵🟣 🌈

🔴 *Service:*  ${svc}
🟠 *Number:*   ${num}
🟡 *Country:*  ${fl} ${cty}
🟢 *Time:*     ${now}
🔵 *OTP:*      \`${code}\`
🟣 *Msg:*      _${msg.slice(0, 80)}_

🌈 🔴🟠🟡🟢🔵🟣 🌈
${SIG}`;

    // ── 12 · Focus 🎯 ─────────────────────────────────────────────────────────
    case 12: return `🎯 *OTP RECEIVED*
━━━━━━━━━━━━━━━━━━━━

  \`${code}\`

━━━━━━━━━━━━━━━━━━━━
_${svc} · ${fl} ${cty}_
${SIG}`;

    // ── 13 · Royal 👑 ─────────────────────────────────────────────────────────
    case 13: return `👑 ══════════════════════ 👑
         ✦ *ROYAL OTP* ✦
👑 ══════════════════════ 👑

👑 *Service:*   ${svc}
👑 *Number:*    ${num}
👑 *Country:*   ${fl} ${cty}
👑 *Time:*      ${now}

👑 ══════════════════════ 👑
👑 *Royal Code:*

  \`${code}\`

👑 ══════════════════════ 👑
_Sealed by ${pnl}_
${SIG}`;

    // ── 14 · Luxury 🚁 ────────────────────────────────────────────────────────
    case 14: return `🚁 ╭────────────────────────────╮
🚁 │   ✨ *LUXURY OTP PANEL* ✨   │
🚁 ├────────────────────────────┤
🚁 │ 📱 *Num:*  ${num.slice(0, 16)}
🚁 │ ${fl} *Cty:*  ${cty.slice(0, 16)}
🚁 │ 📡 *Svc:*  ${svc.slice(0, 16)}
🚁 │ 🕐 *Time:* ${now.slice(11, 19)}
🚁 ├────────────────────────────┤
🚁 │ 🔑 *OTP:*  \`${code}\`
🚁 ╰────────────────────────────╯
${SIG}`;

    default:
      return `🔑 *OTP:* \`${code}\`\n📱 ${num} · ${fl} ${cty} · ${svc}${SIG}`;
  }
}

module.exports = { buildWhatsAppOtpMessage };