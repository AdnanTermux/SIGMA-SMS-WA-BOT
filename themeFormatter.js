'use strict';

/**
 * themeFormatter.js  –  v3
 * 15 premium OTP themes for Telegram (HTML parse mode).
 * <tg-emoji> animated emoji – Telegram only, never sent to WhatsApp.
 */

const { escHtml } = require('./utils');

// ─── Animated emoji registry ──────────────────────────────────────────────────
const EMOJI = {
  fire:      { id: '5402406965252989103', s: '🔥' },
  key:       { id: '6176966310920983412', s: '🔑' },
  bolt:      { id: '5411590687663608498', s: '⚡' },
  lock:      { id: '5291873529464122510', s: '🔒' },
  gem:       { id: '5235940101643883746', s: '💎' },
  crown:     { id: '5319149831673887746', s: '👑' },
  star:      { id: '5778458646534952216', s: '⭐' },
  skull:     { id: '5807631052251861399', s: '💀' },
  robot:     { id: '5339267587337370029', s: '🤖' },
  tap:       { id: '6319056439096644016', s: '👆' },
  check:     { id: '5778475783454463308', s: '✅' },
  cancel:    { id: '5974083768233760323', s: '❌' },
  phone:     { id: '5312310156384557787', s: '📱' },
  chat:      { id: '5040036030414062506', s: '💬' },
  envelope:  { id: '5274102582585877844', s: '📩' },
  clock:     { id: '5805205259018048822', s: '🕐' },
  earth:     { id: '5224450179368767019', s: '🌍' },
  satellite: { id: '5352564488258200671', s: '📡' },
  mega:      { id: '6104927893912030655', s: '📢' },
  doc:       { id: '5258079129051356005', s: '📄' },
  notepad:   { id: '5357419403325481793', s: '📝' },
  rainbow:   { id: '5373141891321699086', s: '🌈' },
  heli:      { id: '5407025283456835479', s: '🚁' },
  globe:     { id: '5224450179368767019', s: '🌐' },
  diamond:   { id: '5235940101643883746', s: '💠' },
  shield:    { id: '5291873529464122510', s: '🛡' },
  zap:       { id: '5411590687663608498', s: '⚡' },
  sparkle:   { id: '5778458646534952216', s: '✨' },
  trophy:    { id: '5319149831673887746', s: '🏆' },
  target:    { id: '5778458646534952216', s: '🎯' },
};

/** Animated emoji tag for Telegram */
function e(name) {
  const x = EMOJI[name];
  return x ? `<tg-emoji emoji-id="${x.id}">${x.s}</tg-emoji>` : '';
}
/** Static emoji shorthand */
const s = Object.fromEntries(Object.entries(EMOJI).map(([k, v]) => [k, v.s]));

// ─── Timestamp helper ─────────────────────────────────────────────────────────
function ts() { return new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC'; }

// ─── Theme builder ────────────────────────────────────────────────────────────
/**
 * @param {number} themeId   0–14
 * @param {string} number    masked phone
 * @param {string} otp       extracted code
 * @param {string} body      original message (truncated)
 * @param {string} service   detected service
 * @param {string} country   country name
 * @param {string} flag      flag emoji
 * @param {string} panel     bot name
 * @returns {string}         HTML for Telegram
 */
function buildOtpMessage(themeId, number, otp, body, service, country, flag, panel) {
  const id   = Math.min(Math.max(Number(themeId) || 0, 0), 14);
  const num  = escHtml(number  || '•••••••••••');
  const code = escHtml(otp     || '??????');
  const msg  = escHtml((body   || '').slice(0, 280));
  const svc  = escHtml(service || 'Unknown');
  const cty  = escHtml(country || 'Unknown');
  const fl   = flag  || '🌍';
  const pnl  = escHtml(panel  || 'OTP Manager');

  switch (id) {

    // ── 0 · Classic ⭐ ────────────────────────────────────────────────────────
    case 0: return `\
╔══════════════════════════════╗
   ${e('star')} <b>${pnl}</b> ${e('star')}
╚══════════════════════════════╝

${fl} <b>Service ·</b> ${svc}
${e('phone')} <b>Number  ·</b> <code>${num}</code>
${e('earth')} <b>Country ·</b> ${cty}
${e('clock')} <b>Time    ·</b> <code>${ts()}</code>

┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
${e('key')} <b>OTP CODE</b>

  <code>${code}</code>

┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
${e('chat')} <i>${msg}</i>`;

    // ── 1 · Minimal 🎯 ────────────────────────────────────────────────────────
    case 1: return `\
${e('target')} <b>OTP · ${svc}</b>

<code>${code}</code>

${e('phone')} <code>${num}</code>  ${fl} ${cty}`;

    // ── 2 · Developer 👨‍💻 ──────────────────────────────────────────────────────
    case 2: return `\
${e('robot')} <b>[ ${pnl} ]</b>
<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>
<code>SERVICE  »  ${svc.padEnd(20)}</code>
<code>NUMBER   »  ${num.padEnd(20)}</code>
<code>COUNTRY  »  ${(fl + ' ' + cty).padEnd(20)}</code>
<code>TIME     »  ${ts().padEnd(20)}</code>
<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>
<code>OTP      »  ${code.padEnd(20)}</code>
<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>
<i>// ${e('robot')} dev build · ${pnl}</i>`;

    // ── 3 · Electric ⚡ ───────────────────────────────────────────────────────
    case 3: return `\
${e('bolt')}${e('bolt')} <b>INCOMING OTP</b> ${e('bolt')}${e('bolt')}
⚡━━━━━━━━━━━━━━━━━━━━━━━━━━⚡

${s.bolt} <b>Service:</b>  ${svc}
${s.bolt} <b>Number:</b>   <code>${num}</code>
${s.bolt} <b>Country:</b>  ${fl} ${cty}

⚡━━━━━━━━━━━━━━━━━━━━━━━━━━⚡
${e('fire')} <b>CODE:</b>  <code>${code}</code>
⚡━━━━━━━━━━━━━━━━━━━━━━━━━━⚡`;

    // ── 4 · Tech 🔬 ───────────────────────────────────────────────────────────
    case 4: return `\
${e('satellite')} <b>TECH PANEL</b> · <i>${pnl}</i>

<code>┌──────────────────────────────┐</code>
<code>│ SVC  : ${svc.slice(0,22).padEnd(22)} │</code>
<code>│ NUM  : ${num.slice(0,22).padEnd(22)} │</code>
<code>│ CTY  : ${(fl+' '+cty).slice(0,22).padEnd(22)} │</code>
<code>│ BYTES: ${String(msg.length).padEnd(22)} │</code>
<code>│ TIME : ${ts().slice(0,22).padEnd(22)} │</code>
<code>├──────────────────────────────┤</code>
<code>│ OTP  : ${code.padEnd(22)} │</code>
<code>└──────────────────────────────┘</code>`;

    // ── 5 · Premium 💎 ────────────────────────────────────────────────────────
    case 5: return `\
${e('gem')} ◈━━━━━━━━━━━━━━━━━━━━━━━◈ ${e('gem')}
        ✦ <b>PREMIUM OTP</b> ✦
${e('gem')} ◈━━━━━━━━━━━━━━━━━━━━━━━◈ ${e('gem')}

${s.gem} <b>Service</b>   ${svc}
${s.gem} <b>Number</b>    <code>${num}</code>
${s.gem} <b>Country</b>   ${fl} ${cty}
${s.gem} <b>Time</b>      <code>${ts()}</code>

${e('gem')} ◈━━━━━━━━━━━━━━━━━━━━━━━◈ ${e('gem')}
${s.gem} <b>OTP CODE</b>

  <code>${code}</code>

${e('gem')} ◈━━━━━━━━━━━━━━━━━━━━━━━◈ ${e('gem')}`;

    // ── 6 · Ultraminimal 🎲 ───────────────────────────────────────────────────
    case 6: return `<code>${code}</code>  <i>${svc}</i>`;

    // ── 7 · Business 💼 ───────────────────────────────────────────────────────
    case 7: return `\
╔══════════════════════════════╗
  ${e('doc')} <b>OTP VERIFICATION</b>
╚══════════════════════════════╝

${s.doc} <b>Service:</b>     ${svc}
${s.phone} <b>Account:</b>    <code>${num}</code>
${s.earth} <b>Region:</b>     ${fl} ${cty}
${s.clock} <b>Timestamp:</b>  <code>${ts()}</code>

▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸
${e('lock')} <b>Auth Code:</b>  <code>${code}</code>
◂◂◂◂◂◂◂◂◂◂◂◂◂◂◂◂◂◂◂◂◂◂◂◂◂◂◂◂◂◂

<i>Issued by ${pnl}</i>`;

    // ── 8 · Social 🌐 ─────────────────────────────────────────────────────────
    case 8: return `\
${e('globe')} <b>Social OTP Alert</b> ${e('mega')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌐 <b>Platform:</b>  ${svc}
📱 <b>Number:</b>    <code>${num}</code>
${fl} <b>Country:</b>   ${cty}
🕐 <b>Time:</b>      <code>${ts()}</code>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔑 <b>Your Code:</b>

  <code>${code}</code>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<i>Powered by ${pnl}</i>`;

    // ── 9 · Deluxe 🌟 ─────────────────────────────────────────────────────────
    case 9: return `\
${e('sparkle')}${e('star')} <b>DELUXE OTP NOTIFICATION</b> ${e('star')}${e('sparkle')}
══════════════════════════════════

${e('phone')} <b>Number:</b>   <code>${num}</code>
${e('earth')} <b>Country:</b>  ${fl} ${cty}
${e('satellite')} <b>Service:</b>  ${svc}
${e('clock')} <b>Time:</b>     <code>${ts()}</code>

══════════════════════════════════
${e('key')} <b>OTP CODE</b>

  <code>${code}</code>

══════════════════════════════════
${e('chat')} <b>Original Message:</b>
<i>${msg}</i>
══════════════════════════════════
<i>${e('robot')} ${pnl}</i>`;

    // ── 10 · Classic Elegance 📝 ──────────────────────────────────────────────
    case 10: return `\
<code>╔══════════════════════════════╗</code>
<code>║  ✦  ${pnl.slice(0,22).padEnd(22)}  ✦  ║</code>
<code>╠══════════════════════════════╣</code>
<code>║  Service : ${svc.slice(0,19).padEnd(19)} ║</code>
<code>║  Number  : ${num.slice(0,19).padEnd(19)} ║</code>
<code>║  Country : ${(fl+' '+cty).slice(0,19).padEnd(19)} ║</code>
<code>║  Time    : ${ts().slice(11,19).padEnd(19)} ║</code>
<code>╠══════════════════════════════╣</code>
<code>║  OTP     : ${code.padEnd(19)} ║</code>
<code>╚══════════════════════════════╝</code>`;

    // ── 11 · Rainbow 🌈 ───────────────────────────────────────────────────────
    case 11: return `\
${e('rainbow')} 🔴🟠🟡🟢🔵🟣 ${e('rainbow')}

🔴 <b>Service:</b>  ${svc}
🟠 <b>Number:</b>   <code>${num}</code>
🟡 <b>Country:</b>  ${fl} ${cty}
🟢 <b>Time:</b>     <code>${ts()}</code>
🔵 <b>OTP:</b>      <code>${code}</code>
🟣 <b>Msg:</b>      <i>${msg.slice(0, 80)}</i>

${e('rainbow')} 🔴🟠🟡🟢🔵🟣 ${e('rainbow')}`;

    // ── 12 · Focus 🎯 ─────────────────────────────────────────────────────────
    case 12: return `\
${e('target')} <b>OTP RECEIVED</b>
━━━━━━━━━━━━━━━━━━━━

  <code>${code}</code>

━━━━━━━━━━━━━━━━━━━━
<i>${svc} · ${fl} ${cty}</i>`;

    // ── 13 · Royal Premium 👑 ─────────────────────────────────────────────────
    case 13: return `\
${e('crown')} 👑 ══════════════════════ 👑 ${e('crown')}
         ✦ <b>ROYAL OTP</b> ✦
${e('crown')} 👑 ══════════════════════ 👑 ${e('crown')}

${s.crown} <b>Service:</b>   ${svc}
${s.crown} <b>Number:</b>    <code>${num}</code>
${s.crown} <b>Country:</b>   ${fl} ${cty}
${s.crown} <b>Time:</b>      <code>${ts()}</code>

${e('crown')} 👑 ══════════════════════ 👑 ${e('crown')}
${s.crown} <b>Royal Code:</b>

  <code>${code}</code>

${e('crown')} 👑 ══════════════════════ 👑 ${e('crown')}
<i>Sealed by ${pnl}</i>`;

    // ── 14 · Hover Luxury 🚁 ──────────────────────────────────────────────────
    case 14: return `\
  ${e('heli')} ╭────────────────────────────╮
  ${e('heli')} │   ${e('sparkle')} <b>LUXURY OTP PANEL</b> ${e('sparkle')}   │
  ${e('heli')} ├────────────────────────────┤
  ${e('heli')} │ ${s.phone} <b>Num:</b>  <code>${num.slice(0, 18)}</code>
  ${e('heli')} │ ${fl} <b>Cty:</b>  ${cty.slice(0, 18)}
  ${e('heli')} │ ${s.satellite} <b>Svc:</b>  ${svc.slice(0, 18)}
  ${e('heli')} │ ${s.clock} <b>Time:</b> ${ts().slice(11, 19)}
  ${e('heli')} ├────────────────────────────┤
  ${e('heli')} │ ${e('key')} <b>OTP:</b>  <code>${code}</code>
  ${e('heli')} ╰────────────────────────────╯`;

    default: return `${s.key} <b>OTP:</b> <code>${code}</code>\n${s.phone} ${num} · ${fl} ${cty} · ${svc}`;
  }
}

module.exports = { buildOtpMessage, EMOJI, e, s };
