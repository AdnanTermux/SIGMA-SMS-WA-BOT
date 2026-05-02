# 🤖 Sigma OTP Manager  
### Multi‑User WhatsApp OTP Forwarding & Telegram Control Platform

> **Enterprise-grade OTP extraction, forwarding, and session management system**  
> Developed by **Sigma Adnan** · Telegram: **@NONEXPERTCODER**

---

## 🌍 Overview

**Sigma OTP Manager** is a modern, scalable, and production-ready platform designed for secure **multi-user WhatsApp OTP extraction and forwarding**, fully managed through an advanced Telegram bot interface.

Built with **Baileys v6**, **Node.js**, and **Telegram Bot API 9.4+**, this solution enables every Telegram user to operate within their own isolated environment, including:

- Dedicated WhatsApp sessions
- Private OTP history
- Individual forwarding destinations
- Theme customization
- Secret token integrations
- Superadmin governance controls

This system is engineered for **high availability**, **user isolation**, and **automation at scale**.

---

# ✨ Core Features

## 🔗 WhatsApp Integration
- Pairing code authentication (No QR required)
- Baileys v6 socket management
- Auto-reconnect with exponential backoff
- Multiple independent user sessions
- Session restoration on reboot

## 📲 Telegram Bot Management
- Full Telegram bot command system
- Animated inline keyboard UI
- Clipboard OTP copy buttons
- Theme switching controls
- Live user stats dashboard
- Superadmin moderation panel

## 🔍 Advanced OTP Detection
- 150+ regex patterns
- Multi-language support:
  - English
  - Arabic
  - Urdu
  - Hindi
  - Russian
  - Turkish
  - French
  - Spanish
  - Indonesian
- High-accuracy OTP extraction engine

## 🎨 Notification Customization
- 15 professional Telegram OTP themes
- WhatsApp-compatible plain text themes
- HTML formatting
- Animated Telegram emoji support

## 🔒 Security Infrastructure
- Per-user credential isolation
- Masked phone storage
- OTP auto-expiry
- Admin token approval workflow
- Owner-only WhatsApp command execution
- Anonymized public statistics

---

# 📁 Project Architecture

```txt
sigma-otp-manager/
│
├── index.js
├── telegram.js
├── whatsapp.js
├── commands.js
├── pairHelper.js
├── database.js
├── config.js
├── config.json
├── themeFormatter.js
├── whatsappThemeFormatter.js
├── otpRegex.js
├── tokenPolling.js
├── utils.js
├── package.json
│
├── sessions/
│   └── <telegramUserId>/
│
├── tmp/
│
└── README.md
```

---

# 🚀 Deployment Guide

## System Requirements

| Requirement | Version |
|------------|---------|
| Node.js | 18+ |
| npm | Latest |
| Telegram Bot Token | Required |
| WhatsApp Number | Required |

---

## Installation

```bash
git clone <repository-url>
cd sigma-otp-manager
npm install
```

---

## Configuration

Edit the `config.json` file:

```json
{
  "telegram": {
    "token": "YOUR_BOT_TOKEN",
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

---

## Launch Application

```bash
node index.js
```

### Development Mode
```bash
npm run dev
```

---

# 📱 Telegram Command Suite

## User Commands

| Command | Function |
|---------|----------|
| `/start` | Initialize bot |
| `/pair <phone>` | Link WhatsApp |
| `/status` | Session status |
| `/restart` | Reconnect WhatsApp |
| `/otp on/off` | OTP forwarding toggle |
| `/recent` | OTP history |
| `/settheme` | Theme selection |
| `/stats` | Global statistics |
| `/addgroup` | Add destination |
| `/clearhistory` | Purge OTP logs |

---

## Superadmin Commands

| Command | Function |
|---------|----------|
| `/broadcast` | Message all users |
| `/listusers` | User registry |
| `/viewuser` | Inspect user |
| `/deluser` | Remove user |
| `/approvetoken` | Approve token |
| `/rejecttoken` | Reject token |
| `/restart_bot` | Full restart |

---

# 💬 WhatsApp Command System

| Command | Description |
|---------|-------------|
| `.otp on/off` | Enable OTP capture |
| `.addgroup` | Add destination |
| `.listgroups` | Show groups |
| `.recent` | Recent OTP logs |
| `.stats` | Performance metrics |
| `.theme` | Theme configuration |
| `.status` | Uptime check |
| `.ping` | Connectivity test |

---

# 🎨 OTP Theme Collection

### Available Themes:
1. Classic
2. Minimal
3. Developer
4. Electric
5. Tech
6. Premium
7. Ultraminimal
8. Business
9. Social
10. Deluxe
11. Elegance
12. Rainbow
13. Focus
14. Royal
15. Luxury

---

# 📊 Database Design

```json
users → sessions → destinations → tokens → otpHistory → settings → analytics
```

### Includes:
- User profiles
- Session metadata
- OTP history
- Token approval states
- Daily/hourly analytics
- Global system metrics

---

# 🔐 Security Framework

## Protection Measures
- User data isolation
- Session compartmentalization
- Token moderation
- Secure command authorization
- Masked storage
- Automated OTP deletion
- Controlled admin privileges

---

# 🛠 Troubleshooting

| Problem | Solution |
|---------|----------|
| Telegram token invalid | Verify `config.json` |
| WhatsApp disconnected | Restart session |
| Pairing timeout | Retry pairing |
| OTP detection failure | Enable OTP mode |
| Token inactive | Await approval |

---

# 📦 Technology Stack

| Package | Purpose |
|---------|---------|
| `@whiskeysockets/baileys` | WhatsApp integration |
| `node-telegram-bot-api` | Telegram control |
| `axios` | API communication |
| `fs-extra` | File management |
| `pino` | Logging |
| `chalk` | Terminal styling |
| `node-cache` | Runtime caching |

---

# 📈 Scalability Highlights

- Supports unlimited user growth
- Modular architecture
- Lightweight JSON persistence
- Admin broadcasting system
- Multi-token support
- Future API extensibility

---

# 📜 License

**MIT License**

This project is open-source and may be used, modified, and distributed with attribution.

---

# 👨‍💻 Developer

### Sigma Adnan
**Telegram:** @NONEXPERTCODER

> Building modern automation ecosystems for messaging infrastructure.

---
