# 🤖 TuxBot — AI-Rich Telegram Bot & Automation Engine

> **A modern, personal AI-powered Telegram assistant with real-time chat automation, intent-based smart triggers, Google Gemini 2.0 reasoning, and seamless serverless hosting on Vercel.**

---

## ✨ Features

- **🧠 Google Gemini 2.0 AI Reasoning**: Powered by `@google/genai` (Gemini 2.0 Flash / Pro) with conversation context memory.
- **⚡ Smart Chat Automation Engine**:
  - **Exact & Substring Matching**: Fast keyword triggers (`ping`, `status`, etc.).
  - **Regular Expressions (RegEx)**: Pattern-based alerts (e.g. `\b(urgent|asap|critical)\b`).
  - **Semantic Intent Classification**: AI-powered zero-shot classification without fragile keyword lists.
  - **Multi-Action Dispatcher**: Instant template replies, custom AI transformations, external Webhooks (POST to Zapier/Make/n8n/APIs), and priority alerts.
- **🛡️ Personal Security & Access Control**:
  - Restrict bot access exclusively to your Telegram User ID (`ALLOWED_TELEGRAM_USER_IDS`).
  - Webhook secret token validation (`x-telegram-bot-api-secret-token`).
- **🌐 Serverless Vercel Architecture**:
  - Webhook-based (sub-second execution, no long-polling servers needed).
  - Vercel Cron support for automated daily briefings and check-ins.
- **💾 Dual Storage Strategy**:
  - Serverless persistence via **Upstash Redis** (`@upstash/redis`).
  - Automatic in-memory fallback for local development without external dependencies.
- **💻 Sleek Web Console**:
  - Interactive rules manager (Create, Toggle, Test, Delete).
  - Live Automation Simulator to test messages against rules in real-time.
  - AI Persona editor with custom system prompts and presets.
  - Live event audit logs and Telegram webhook status monitor.

---

## 🚀 Quick Setup & Local Development

### 1. Clone & Install Dependencies
```bash
git clone <repo-url> tuxBot
cd tuxBot
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Fill in your credentials:
```env
# From Telegram @BotFather
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# Generate any random string for webhook security
TELEGRAM_SECRET_TOKEN=my_super_secret_webhook_token_123

# Your numeric Telegram User ID (get from @userinfobot)
ALLOWED_TELEGRAM_USER_IDS=123456789

# From https://aistudio.google.com
GEMINI_API_KEY=AIzaSyYourGeminiApiKeyHere
GEMINI_MODEL=gemini-2.0-flash

# Optional: omit these two variables to run without Upstash.
# Without Upstash, rules, settings, logs, and chat history are temporary
# and may be lost when a serverless instance restarts.
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

### 3. Run Locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to access the TuxBot Management Console.

---

## ☁️ Deploying to Vercel

1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "feat: TuxBot AI automation assistant"
   git push origin main
   ```

2. **Import into Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new) and select your repository.
   - In **Project Settings ➔ Environment Variables**, add:
     - `TELEGRAM_BOT_TOKEN`
     - `TELEGRAM_SECRET_TOKEN`
     - `ALLOWED_TELEGRAM_USER_IDS`
     - `GEMINI_API_KEY`
     - `GEMINI_MODEL` (`gemini-2.0-flash`)
      - `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN` (optional)
     - `NEXT_PUBLIC_APP_URL` (e.g. `https://your-bot.vercel.app`)

3. **Register Webhook with Telegram**:
   - After deployment finishes, open your deployed web console (`https://your-bot.vercel.app`).
   - Click the **"Register Webhook"** button in the top banner.
   - Alternatively, trigger via `curl`:
     ```bash
     curl -X POST https://your-bot.vercel.app/api/bot/set-webhook \
       -H "Content-Type: application/json" \
       -d '{"url": "https://your-bot.vercel.app/api/webhook"}'
     ```

4. **Start Chatting**:
   Open Telegram, message your bot, and send `/start`!

---

## ⚡ Built-in Automation Commands & Examples

| Trigger / Command | Type | Description |
|-------------------|------|-------------|
| `/start` | Command | Opens main menu with interactive inline buttons |
| `/rules` | Command | Displays currently active automation rules |
| `/mode <chat\|concise\|coder>` | Command | Changes the bot's AI persona on the fly |
| `/clear` | Command | Clears your conversation context memory |
| `/stats` | Command | Displays execution counts and system health |
| `ping` | Exact | Heartbeat response (`🏓 Pong!`) |
| `extract: <text>` | Substring | AI extracts action items & deadlines into a checklist |
| `meeting: <text>` | Substring | AI structures notes into executive meeting minutes |
| `urgent` / `asap` | RegEx | Flags priority alert and logs critical tag |

---

## 🛠️ Architecture Overview

```
tuxBot/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── webhook/route.ts      # Vercel Serverless Webhook Endpoint (POST / GET)
│   │   │   ├── rules/route.ts        # Automation Rules CRUD
│   │   │   ├── rules/test/route.ts   # Rule Simulator Endpoint
│   │   │   ├── bot/status/route.ts   # Bot Diagnostics & Status
│   │   │   ├── bot/set-webhook/route.ts # 1-Click Telegram Webhook Setup
│   │   │   ├── cron/briefing/route.ts# Vercel Cron Daily Morning Briefing
│   │   │   ├── logs/route.ts         # Live Audit Logs
│   │   │   └── settings/route.ts     # AI Settings & Persona Configuration
│   │   ├── layout.tsx                # Inter + Mono Fonts & Metadata
│   │   ├── page.tsx                  # Web Dashboard Console
│   │   └── globals.css               # Vanilla CSS Design System
│   └── lib/
│       ├── types.ts                  # Core Interfaces & Type Definitions
│       ├── config.ts                 # Environment Configurations
│       ├── storage.ts                # Dual Upstash Redis + Memory Storage
│       ├── gemini.ts                 # Google Gemini 2.0 Client & Intent Classifier
│       ├── automation.ts             # Rule Matcher & Action Execution Engine
│       └── bot.ts                    # Grammy Bot Engine, Middleware & Handlers
├── vercel.json                       # Vercel Cron & Serverless Config
├── package.json                      # Next.js 16, React 19, Grammy, @google/genai
└── .env.example                      # Complete Environment Variable Template
```

---

## 📜 License
MIT License. Built with ❤️ for automated AI workflows.
