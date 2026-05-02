# 🤖 Multi-User WhatsApp OTP Manager — v4.0.0

> Developed by **Sigma Adnan** · [@NONEXPERTCODER](https://t.me/NONEXPERTCODER)

A production-ready, **multi-user** WhatsApp OTP extractor and forwarder controlled entirely via a Telegram bot. Each Telegram user gets their own isolated WhatsApp session, forwarding destinations, OTP history, and settings.

---

## ✨ Features

- **WhatsApp linking** via pairing code (no QR needed) using Baileys v6
- **15 animated OTP themes** for Telegram notifications
- **150+ OTP regex patterns** covering English, Arabic, Urdu, Hindi, Russian, and more
- **Per-user isolation**: every user has their own session, settings, history, and destinations
- **WhatsApp group/channel forwarding**: forward received OTPs to any WA group or channel you're in
- **Inline keyboard UI** with animated emoji buttons (Bot API 9.4+)
- **Copy-to-clipboard** buttons for OTPs
- **Auto-reconnect** with exponential back-off on WhatsApp disconnect
- **Global public stats** fetched live from `tempnum.net`
- **Superadmin broadcast** to all registered users

---

## 📁 File Structure

```
sigma-otp-manager/
├── index.js            # Entry point — starts Telegram bot, restores WA sessions
├── telegram.js         # Telegram bot — all commands and callback handlers
├── whatsapp.js         # Baileys socket manager (one socket per user)
├── commands.js         # WhatsApp in-chat command handlers (.otp, .addgroup, …)
├── pairHelper.js       # Pairing code flow with retry logic
├── database.js         # JSON-backed per-user data store
├── config.js           # Config loader / helpers
├── config.json         # Bot settings (fill in your token & superadmin IDs)
├── themeFormatter.js   # 15 OTP message themes with animated emoji
├── otpRegex.js         # 150+ compiled OTP regex patterns
├── utils.js            # Helpers: btn(), sendBox(), maskPhone(), etc.
├── package.json
├── sessions/           # Auto-created — one subfolder per user
└── tmp/                # Auto-created — temp pairing sessions
```

---

## 🚀 Quick Start

### 1. Prerequisites

- **Node.js ≥ 18**
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- Your Telegram user ID (get it from [@userinfobot](https://t.me/userinfobot))

### 2. Install

```bash
git clone <your-repo>
cd sigma-otp-manager
npm install
```

### 3. Configure

Edit `config.json`:

```json
{
  "telegram": {
    "token": "YOUR_BOT_TOKEN_HERE",
    "superadmin_ids": [YOUR_TELEGRAM_ID]
  },
  "whatsapp": {
    "command_prefix": ".",
    "session_base_dir": "sessions"
  },
  "bot": {
    "name": "Sigma OTP Manager",
    "developer": "@NONEXPERTCODER",
    "number_bot_link": "https://t.me/YourNumberBot",
    "support_link": "https://t.me/YourSupport"
  },
  "public_stats_api": "https://tempnum.net/api/public/stats",
  "OTP_GUI_THEME": 0
}
```

### 4. Run

```bash
node index.js
# or for auto-restart on file changes:
node --watch index.js
```

---

## 📱 Telegram Commands

| Command | Description |
|---|---|
| `/start` | Welcome screen with stats and quick buttons |
| `/pair <phone>` | Link your WhatsApp (e.g. `/pair +923001234567`) |
| `/status` | Show WhatsApp connection status and your stats |
| `/restart` | Restart your WhatsApp socket |
| `/sessions` | List your stored WhatsApp sessions |
| `/delpair <id>` | Delete a stored session |
| `/otp on\|off` | Enable or disable OTP forwarding |
| `/addgroup <link>` | Add a WA group or channel to forward OTPs to |
| `/delgroup <id>` | Remove a forwarding destination |
| `/listgroups` | List your forwarding destinations |
| `/stats` | Fetch live global stats from tempnum.net |
| `/recent [n]` | Show your last N OTPs (masked, with copy buttons) |
| `/settheme <0-14>` | Change your OTP notification theme |
| `/clearhistory` | Wipe your OTP history |
| `/menu` or `/help` | Show all commands |
| `/broadcast <msg>` | *(Superadmin only)* Send a message to all users |

---

## 💬 WhatsApp In-Chat Commands

Use these directly in any WhatsApp chat from the linked account (default prefix: `.`):

| Command | Description |
|---|---|
| `.otp on\|off` | Toggle OTP extraction |
| `.addgroup <link>` | Join group/subscribe channel and add as destination |
| `.addjid <jid> [name]` | Add an already-joined group by JID |
| `.delgroup <id>` | Remove a forwarding destination |
| `.listgroups` | List forwarding destinations |
| `.getid` | Show current chat JID |
| `.stats` | Your OTP statistics |
| `.recent [n]` | Last N OTPs |
| `.ping` | Liveness check |
| `.status` | Connection status and uptime |
| `.theme [0-14]` | Show or set OTP theme |
| `.clearhistory` | Wipe OTP history |
| `.help` | List all commands |

---

## 🎨 OTP Themes (0–14)

| # | Name | Style |
|---|---|---|
| 0 | Classic ⭐ | Box border, all fields, original message |
| 1 | Minimal 🎯 | OTP + service on 3 lines |
| 2 | Developer 👨‍💻 | Monospace table with padded columns |
| 3 | Electric ⚡ | Lightning separators, bold |
| 4 | Tech 🔬 | ASCII box with field labels |
| 5 | Premium 💎 | Diamond separators, gem icons |
| 6 | Ultraminimal 🎲 | Single line: code + service |
| 7 | Business 💼 | Transaction-style with auth code |
| 8 | Social 🌐 | Social alert banner |
| 9 | Deluxe 🌟 | Full details + original message |
| 10 | Elegance 📝 | Monospace bordered table |
| 11 | Rainbow 🌈 | Colour-coded fields |
| 12 | Focus 🎯 | OTP only, minimal chrome |
| 13 | Royal 👑 | Crown-decorated premium |
| 14 | Luxury 🚁 | Helicopter emoji side decorations |

Change themes with `/settheme <number>` in Telegram or `.theme <number>` in WhatsApp.

---

## 🔒 Security Notes

- **Session isolation**: each user's WhatsApp credentials are stored in `sessions/<telegramId>/` and never shared.
- **Phone masking**: phone numbers are masked before storage and display (e.g. `+92•••••1234`).
- **OTP auto-delete**: OTP messages in Telegram are auto-deleted after 15 minutes.
- **Owner-only commands**: WhatsApp commands only work on messages sent from the linked device's own account.

---

## 🗃 Database Schema (`database.json`)

```json
{
  "users": {
    "<telegramId>": {
      "sessions": [{ "sessionId": "…", "phone": "…", "status": "active", "createdAt": "…" }],
      "forwardDestinations": [{ "id": 1, "jid": "…", "name": "…", "type": "group|channel" }],
      "otpHistory": [{ "phoneMasked": "…", "otp": "…", "service": "…", "country": "…", "receivedAt": "…" }],
      "settings": { "otp_enabled": true, "command_prefix": ".", "theme": 0 },
      "registeredAt": "…"
    }
  },
  "allUserIds": [123456789]
}
```

---

## 🛠 Troubleshooting

| Issue | Fix |
|---|---|
| `Telegram token not set` | Set your token in `config.json` |
| WhatsApp keeps disconnecting | Check your internet; the bot auto-reconnects with back-off |
| Pairing code times out | Run `/pair <phone>` again; code expires in ~60 s |
| OTPs not detected | Check `/otp on`; try `.otp on` in WhatsApp |
| `creds.json` not found on startup | No session to restore — user must `/pair` first |

---

## 📦 Dependencies

| Package | Purpose |
|---|---|
| `@whiskeysockets/baileys` | WhatsApp Web API |
| `node-telegram-bot-api` | Telegram Bot API |
| `fs-extra` | File system helpers |
| `chalk` | Coloured terminal output |
| `pino` | Silent logger for Baileys |
| `axios` | HTTP client for public stats API |
| `node-cache` | In-memory caching (available for extensions) |

---

## 📜 License

MIT — use freely, credit appreciated.

> ✨ **Developed by Sigma Adnan** · [@NONEXPERTCODER](https://t.me/NONEXPERTCODER)
