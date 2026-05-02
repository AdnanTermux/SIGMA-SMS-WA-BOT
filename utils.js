'use strict';

const axios = require('axios');
const { getConfig } = require('./config');

// ─── Animated emoji IDs (Bot API 9.4+) ───────────────────────────────────────
const ANIMATED_IDS = {
  fire:      '5402406965252989103',
  key:       '6176966310920983412',
  bolt:      '5411590687663608498',
  lock:      '5291873529464122510',
  gem:       '5235940101643883746',
  crown:     '5319149831673887746',
  star:      '5778458646534952216',
  skull:     '5807631052251861399',
  robot:     '5339267587337370029',
  tap:       '6319056439096644016',
  check:     '5778475783454463308',
  cancel:    '5974083768233760323',
  phone:     '5312310156384557787',
  chat:      '5040036030414062506',
  envelope:  '5274102582585877844',
  clock:     '5805205259018048822',
  earth:     '5224450179368767019',
  satellite: '5352564488258200671',
  mega:      '6104927893912030655',
  doc:       '5258079129051356005',
  notepad:   '5262974657329394511',
  copy:      '5197219609970758159',
  dev:       '5215263059639017128',
  focus:     '5226851658792717025',
  help:      '5436113877181941026',
  trash:     '5445267414562389170',
  online:    '5319310205752717294',
  offline:   '5319238892115733906',
  refresh:   '5359543311897998264',
  settings:  '5341715473882955310',
  add:       '5397916757333654639',
  edit:      '5395444784611480792',
  warn:      '5447644880824181073',
  database:  '5409260938488458240',
  tools:     '5332272404167140865',
  calendar:  '5413879192267805083',
  users:     '5848183076898737707',
  support:   '5307746710682869587',
  clipboard: '5877618313139327986',
  link:      '5417841026880621073',
  people:    '5359735404426468588',
  stats:     '5409260938488458240',
  pair:      '6176966310920983412',
  recent:    '5805205259018048822',
  theme:     '5778458646534952216',
  otp:       '5291873529464122510',
  group:     '5359735404426468588',
  token:     '6176966310920983412',
  approve:   '5778475783454463308',
  reject:    '5974083768233760323',
};

/**
 * Build an InlineKeyboardButton.
 * @param {string} text
 * @param {object} opts  { cb, url, style, icon, copy }
 */
function btn(text, opts = {}) {
  const b = { text };
  if (opts.cb)    b.callback_data        = opts.cb;
  if (opts.url)   b.url                  = opts.url;
  if (opts.style) b.style                = opts.style;
  if (opts.icon && ANIMATED_IDS[opts.icon]) b.icon_custom_emoji_id = ANIMATED_IDS[opts.icon];
  if (opts.copy !== undefined) b.copy_text = { text: String(opts.copy) };
  return b;
}

/** Send a styled box message. */
function sendBox(bot, chatId, title, lines, rows = []) {
  const W   = 32;
  const top = `╔${'═'.repeat(W)}╗`;
  const sep = `┣${'━'.repeat(W)}┫`;
  const end = `╰${'━'.repeat(W)}╯`;
  const mid = lines.map(l => `┃  ${l}`);
  const text = ['', top, `┃  ✦  ${title}`, sep, ...mid, end].join('\n');
  return bot.sendMessage(chatId, text, {
    parse_mode:   'HTML',
    reply_markup: rows.length ? { inline_keyboard: rows } : undefined,
  });
}

/** Edit an existing message in-place. */
function editBox(bot, chatId, msgId, title, lines, rows = []) {
  const W   = 32;
  const top = `╔${'═'.repeat(W)}╗`;
  const sep = `┣${'━'.repeat(W)}┫`;
  const end = `╰${'━'.repeat(W)}╯`;
  const mid = lines.map(l => `┃  ${l}`);
  const text = ['', top, `┃  ✦  ${title}`, sep, ...mid, end].join('\n');
  return bot.editMessageText(text, {
    chat_id:      chatId,
    message_id:   msgId,
    parse_mode:   'HTML',
    reply_markup: rows.length ? { inline_keyboard: rows } : undefined,
  }).catch(() => {});
}

// ─── Standard developer button ────────────────────────────────────────────────
const DEV_BTN = btn('👨‍💻 Developer', { url: 'https://t.me/NONEXPERTCODER', style: 'primary', icon: 'dev' });
const suppBtn = () => {
  const cfg = getConfig();
  return btn('💬 Support', { url: cfg.bot?.support_link || 'https://t.me/YourSupport', style: 'primary', icon: 'support' });
};

// ─── Phone masking ────────────────────────────────────────────────────────────
function maskPhone(phone) {
  if (!phone) return '•••••••••••';
  const str     = String(phone).replace(/\s/g, '');
  if (str.length <= 6) return '••••••';
  const visible = str.slice(-4);
  const prefix  = str.startsWith('+') ? str.slice(0, 3) : str.slice(0, 2);
  const dots    = '•'.repeat(Math.max(3, str.length - prefix.length - 4));
  return `${prefix}${dots}${visible}`;
}

/** Mask a token for display: first4•••last4 */
function maskToken(token) {
  if (!token || token.length < 8) return '••••••••';
  return `${token.slice(0, 4)}•••${token.slice(-4)}`;
}

// ─── Country flags ────────────────────────────────────────────────────────────
const COUNTRY_FLAGS = {
  PK:'🇵🇰',IN:'🇮🇳',US:'🇺🇸',GB:'🇬🇧',AE:'🇦🇪',SA:'🇸🇦',BD:'🇧🇩',
  NG:'🇳🇬',EG:'🇪🇬',TR:'🇹🇷',ID:'🇮🇩',BR:'🇧🇷',MX:'🇲🇽',DE:'🇩🇪',
  FR:'🇫🇷',RU:'🇷🇺',CN:'🇨🇳',JP:'🇯🇵',KR:'🇰🇷',IR:'🇮🇷',IQ:'🇮🇶',
  MA:'🇲🇦',DZ:'🇩🇿',TN:'🇹🇳',LY:'🇱🇾',SY:'🇸🇾',JO:'🇯🇴',LB:'🇱🇧',
  KW:'🇰🇼',QA:'🇶🇦',BH:'🇧🇭',OM:'🇴🇲',YE:'🇾🇪',PH:'🇵🇭',VN:'🇻🇳',
  TH:'🇹🇭',MY:'🇲🇾',SG:'🇸🇬',AU:'🇦🇺',CA:'🇨🇦',AR:'🇦🇷',CO:'🇨🇴',
  CL:'🇨🇱',ES:'🇪🇸',IT:'🇮🇹',NL:'🇳🇱',PL:'🇵🇱',UA:'🇺🇦',DEFAULT:'🌍',
};

function getCountryFlag(code) {
  return COUNTRY_FLAGS[(code || '').toUpperCase()] || COUNTRY_FLAGS.DEFAULT;
}

const PREFIX_MAP = [
  ['380','Ukraine','UA'],['971','UAE','AE'],['966','Saudi Arabia','SA'],
  ['880','Bangladesh','BD'],['234','Nigeria','NG'],['964','Iraq','IQ'],
  ['212','Morocco','MA'],['213','Algeria','DZ'],['216','Tunisia','TN'],
  ['218','Libya','LY'],['963','Syria','SY'],['962','Jordan','JO'],
  ['961','Lebanon','LB'],['965','Kuwait','KW'],['974','Qatar','QA'],
  ['973','Bahrain','BH'],['968','Oman','OM'],['967','Yemen','YE'],
  ['92','Pakistan','PK'],['91','India','IN'],['90','Turkey','TR'],
  ['86','China','CN'],['84','Vietnam','VN'],['82','South Korea','KR'],
  ['81','Japan','JP'],['66','Thailand','TH'],['65','Singapore','SG'],
  ['63','Philippines','PH'],['62','Indonesia','ID'],['61','Australia','AU'],
  ['60','Malaysia','MY'],['57','Colombia','CO'],['56','Chile','CL'],
  ['55','Brazil','BR'],['54','Argentina','AR'],['52','Mexico','MX'],
  ['49','Germany','DE'],['48','Poland','PL'],['44','UK','GB'],
  ['39','Italy','IT'],['34','Spain','ES'],['33','France','FR'],
  ['31','Netherlands','NL'],['20','Egypt','EG'],['98','Iran','IR'],
  ['7','Russia','RU'],['1','USA/Canada','US'],
].sort((a, b) => b[0].length - a[0].length);

function guessCountryFromPhone(phone) {
  const n = String(phone || '').replace(/\D/g, '');
  for (const [prefix, country, code] of PREFIX_MAP) {
    if (n.startsWith(prefix)) return { country, code, flag: getCountryFlag(code) };
  }
  return { country: 'Unknown', code: 'XX', flag: '🌍' };
}

// ─── Uptime ───────────────────────────────────────────────────────────────────
function formatUptime(ms) {
  if (!ms || ms < 0) return '–';
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / 60000) % 60;
  const h = Math.floor(ms / 3600000) % 24;
  const d = Math.floor(ms / 86400000);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

// ─── Service detector ─────────────────────────────────────────────────────────
const SERVICE_KEYWORDS = [
  ['WhatsApp',  /whatsapp/i],  ['Telegram',  /telegram/i],
  ['Instagram', /instagram/i], ['Facebook',  /facebook|fb\.com/i],
  ['Google',    /google/i],    ['Apple',     /apple|icloud/i],
  ['Microsoft', /microsoft|outlook|hotmail/i],
  ['Twitter',   /twitter|x\.com/i], ['Amazon', /amazon|aws/i],
  ['Binance',   /binance/i],   ['Coinbase',  /coinbase/i],
  ['Bybit',     /bybit/i],     ['KuCoin',    /kucoin/i],
  ['Uber',      /uber/i],      ['Grab',      /grab/i],
  ['Careem',    /careem/i],    ['Swiggy',    /swiggy/i],
  ['Zomato',    /zomato/i],    ['Flipkart',  /flipkart/i],
  ['Daraz',     /daraz/i],     ['Jazz',      /\bjazz\b/i],
  ['Telenor',   /telenor/i],   ['Airtel',    /airtel/i],
  ['Jio',       /\bjio\b/i],   ['Vodafone',  /vodafone/i],
  ['Bank',      /bank|banking/i], ['PayPal', /paypal/i],
];

function detectService(text) {
  if (!text) return 'Unknown';
  for (const [name, re] of SERVICE_KEYWORDS) {
    if (re.test(text)) return name;
  }
  return 'Unknown';
}

// ─── HTML escape ──────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function progressBar(value, max, width = 10, filled = '█', empty = '░') {
  const pct  = max > 0 ? Math.min(value / max, 1) : 0;
  const bars = Math.round(pct * width);
  return filled.repeat(bars) + empty.repeat(width - bars);
}

// ─── Fetch public stats ───────────────────────────────────────────────────────
async function fetchPublicStats() {
  const cfg = getConfig();
  const url = cfg.public_stats_api || 'https://tempnum.net/api/public/stats';
  const res = await axios.get(url, { timeout: 8000 });
  return res.data;
}

module.exports = {
  ANIMATED_IDS, btn, sendBox, editBox, DEV_BTN, suppBtn,
  maskPhone, maskToken, getCountryFlag, guessCountryFromPhone,
  formatUptime, detectService, escHtml, progressBar, fetchPublicStats,
};