<div align="center">

# 🌉 EduBridge

**Rural-first · Offline-capable · Adaptive Learning Platform**

*Built for schools with intermittent or zero internet connectivity*

[![Python](https://img.shields.io/badge/Python-3.9%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Django](https://img.shields.io/badge/Django-3.2-092E20?style=for-the-badge&logo=django&logoColor=white)](https://www.djangoproject.com/)
[![Vue.js](https://img.shields.io/badge/Vue.js-3.x-4FC08D?style=for-the-badge&logo=vue.js&logoColor=white)](https://vuejs.org/)
[![Kolibri](https://img.shields.io/badge/Kolibri-Platform-FF6B35?style=for-the-badge)](https://learningequality.org/kolibri/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](kolibri/LICENSE)
[![Render](https://img.shields.io/badge/Deploy-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://render.com)

---

> **EduBridge** is an open-source, offline-first adaptive learning platform built on top of [Kolibri](https://learningequality.org/kolibri/) by Learning Equality. It extends Kolibri with an AI-powered co-pilot (Gemini), Bayesian Knowledge Tracing (BKT) adaptive engine, peer-to-peer content mesh networking, and cloud sync — all designed to work reliably in low-bandwidth, rural school environments.

</div>

---

## 📋 Table of Contents

- [✨ Features](#-features)
- [🏗️ Architecture](#️-architecture)
- [🛠️ Tech Stack](#️-tech-stack)
- [⚙️ Prerequisites](#️-prerequisites)
- [🚀 Local Development Setup](#-local-development-setup)
- [🔧 Configuration](#-configuration)
- [☁️ Production Deployment](#️-production-deployment)
- [📦 Build Order](#-build-order)
- [🧪 Running Tests](#-running-tests)
- [📚 API Reference](#-api-reference)
- [🔬 Module Status](#-module-status)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## ✨ Features

| Feature | Description |
|---|---|
| 📶 **Offline-First** | Full functionality with zero internet; IndexedDB sync queue, auto-retry on reconnect |
| 🧠 **Adaptive Engine** | Bayesian Knowledge Tracing (BKT) adjusts content difficulty in real-time per student |
| 🤖 **AI Co-Pilot** | Gemini-powered chatbot with 4-level graceful degradation (online → cached → local → offline) |
| 🌐 **Content Mesh** | BroadcastChannel + WebRTC peer-to-peer content sharing between devices on LAN |
| 🔒 **Secure by Default** | AES-GCM encryption via Web Crypto API; JWT auth; Row Level Security |
| 👨‍👩‍👧 **Multi-Role** | Student, Teacher, Coach, Parent dashboard, and District Admin panels |
| 📊 **Analytics** | Skill gap detection, mastery tracking, and progress reporting |
| 📱 **PWA-Ready** | Progressive Web App with service worker for full offline caching |
| 🔄 **Cloud Sync** | Idempotent sync with Last-Write-Wins (LWW) conflict resolution |
| 📲 **SMS Fallback** | Twilio-based SMS notifications for low-tech parent communication |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    EduBridge Platform                   │
├─────────────────────────────────────────────────────────┤
│  Vue.js Frontend  (Kolibri Plugin System)               │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │  Learn  │ │  Coach   │ │  Device  │ │  User Auth │  │
│  └─────────┘ └──────────┘ └──────────┘ └────────────┘  │
│         │           │            │             │        │
│  ┌──────▼───────────▼────────────▼─────────────▼─────┐  │
│  │   BKT Engine  │  AI Co-Pilot  │  Content Mesh     │  │
│  │   (bkt.js)    │ (Gemini API)  │  (WebRTC/BC)      │  │
│  └───────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  Django/DRF Backend (Kolibri Core + EduBridge Plugins)  │
│  ┌──────────┐ ┌─────────┐ ┌──────────┐ ┌────────────┐  │
│  │   Auth   │ │ Content │ │  Logger  │ │ AI CoPilot │  │
│  │   API    │ │   API   │ │   API    │ │    API     │  │
│  └──────────┘ └─────────┘ └──────────┘ └────────────┘  │
├─────────────────────────────────────────────────────────┤
│  Storage Layer                                          │
│  ┌──────────────────┐    ┌─────────────────────────┐    │
│  │  SQLite (local)  │◄──►│ PostgreSQL (Supabase)   │    │
│  │  IndexedDB (PWA) │    │ cloud sync via morango  │    │
│  └──────────────────┘    └─────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Backend
- **Framework**: [Kolibri](https://github.com/learningequality/kolibri) (Django 3.2 + DRF)
- **Language**: Python 3.9 – 3.14
- **Database**: SQLite (local dev) / PostgreSQL via Supabase (production)
- **Sync Engine**: [Morango](https://github.com/learningequality/morango)
- **AI**: Google Gemini API
- **Auth**: JWT (self-hosted)
- **Package Manager**: `uv`

### Frontend
- **Framework**: Vue.js 3 (via Kolibri's plugin system)
- **Build Tool**: webpack (Kolibri build toolchain)
- **Package Manager**: pnpm
- **Offline Storage**: IndexedDB
- **Content Sharing**: BroadcastChannel API + WebRTC
- **Encryption**: Web Crypto API (AES-GCM)

### Zero-Cost Infrastructure
| Layer | Service | Tier |
|---|---|---|
| Backend | [Render Web Service](https://render.com) | Free 750 hrs/mo |
| Database | [Supabase PostgreSQL](https://supabase.com) | Free 500 MB |
| Frontend | [Render Static Site](https://render.com) | Free forever |
| AI | [Gemini API](https://aistudio.google.com) | Free 15 RPM / 1M TPM |
| Media/CDN | [Cloudinary](https://cloudinary.com) | Free 25 GB bandwidth |
| SMS | Twilio trial credit | Trial (~$15) |

---

## ⚙️ Prerequisites

Make sure the following are installed on your machine:

| Tool | Version | Install |
|---|---|---|
| Python | 3.9 – 3.14 | [python.org](https://www.python.org/downloads/) |
| Node.js | 18+ | [nodejs.org](https://nodejs.org/) |
| pnpm | Latest | `npm install -g pnpm` |
| uv | Latest | `pip install uv` or [uv docs](https://docs.astral.sh/uv/) |
| Git | Any | [git-scm.com](https://git-scm.com/) |

---

## 🚀 Local Development Setup

### Step 1 — Clone the Repository

```bash
git clone https://github.com/Mugunthan-127/EduBridge.git
cd EduBridge
```

### Step 2 — Navigate to the Platform Directory

The main Kolibri application lives in the `kolibri/` subfolder:

```bash
cd kolibri
```

### Step 3 — Set Up the Python Environment

```bash
# Install uv (if not already installed)
pip install uv

# Install all base dependencies into a virtual environment
uv sync --group base

# For development (adds test tools, linters, debuggers)
uv sync --group dev
```

> **Windows note**: If `uv` is not found, restart your terminal or add `%APPDATA%\Python\Scripts` to your `PATH`.

### Step 4 — Install Frontend Dependencies

```bash
# From inside the kolibri/ directory
pnpm install
```

### Step 5 — Set Up Environment Variables

Create a local `.env` file (never committed to Git):

```bash
# Windows
copy .env.example .env

# macOS / Linux
cp .env.example .env
```

Edit `.env` and fill in your values:

```env
# AI — get a free key at https://aistudio.google.com
GEMINI_API_KEY=your_gemini_api_key_here

# Django secret key (generate a strong random string, 50+ chars)
KOLIBRI_SECRET_KEY=your_super_secret_key_here

# Database — leave blank to use local SQLite for development
KOLIBRI_DB_URL=

# SMS notifications (optional)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
```

### Step 6 — Initialize the Database

```bash
# Run all Django migrations
uv run kolibri manage migrate

# (Optional) Load demo seed data for development
uv run kolibri manage loaddata kolibri/fixtures/demo_data.json
```

### Step 7 — Create an Admin Account

```bash
uv run kolibri manage createsuperuser
```

Follow the prompts to set your admin username and password.

### Step 8 — Build the Frontend

```bash
# Development build with hot-reload watcher (recommended for active development)
pnpm run dev

# OR one-time production-style build
pnpm run build
```

### Step 9 — Start the Development Server

Open a **new terminal** (keep the frontend watcher running), then:

```bash
uv run kolibri start --foreground
```

Your EduBridge instance is now running at:
- **App**: [http://localhost:8080](http://localhost:8080)
- **Admin panel**: [http://localhost:8080/en/user/#/sign-in](http://localhost:8080/en/user/#/sign-in)

---

## 🔧 Configuration

### Backend Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes (for AI) | Google Gemini API key |
| `KOLIBRI_SECRET_KEY` | Yes | Django secret key for sessions/JWT |
| `KOLIBRI_DB_URL` | No | PostgreSQL URL (defaults to SQLite in dev) |
| `TWILIO_ACCOUNT_SID` | No | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | No | Twilio Auth Token |
| `TWILIO_PHONE_NUMBER` | No | Twilio sender phone number |

### Frontend Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_API_BASE_URL` | Yes (prod) | Backend API base URL |

---

## ☁️ Production Deployment

### Option 1: Render + Supabase (Recommended — Zero Cost)

A `render.yaml` is included at the repo root for one-click deployment.

#### 1. Set Up Supabase (Database)

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **Project Settings → Database → URI** and copy the connection string:
   ```
   postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
   ```

#### 2. Deploy to Render

1. Fork this repository to your GitHub account
2. Go to [render.com](https://render.com) → **New → Blueprint**
3. Connect your forked repo — Render auto-detects `render.yaml`
4. Set these **Environment Variables** in the Render dashboard:
   ```
   KOLIBRI_DB_URL     = postgresql://...   (your Supabase URL)
   GEMINI_API_KEY     = AIza...
   KOLIBRI_SECRET_KEY = <random 50+ char string>
   ```
5. Click **Apply** — Render will deploy on every push to `main`

> ⚠️ **Free-tier note**: Render's free web service sleeps after 15 minutes of inactivity. The first request after sleep takes ~30 seconds. Upgrade to the $7/mo plan for always-on availability.

---

### Option 2: Docker

```bash
# From the kolibri/ directory
docker-compose up --build
```

This starts the Kolibri backend with a local PostgreSQL instance.

---

### Option 3: Raspberry Pi / School Server

Kolibri is optimized for low-powered hardware. See the official [Kolibri installation guide](https://kolibri.readthedocs.io/en/stable/install/) for Raspberry Pi and offline school server setup.

---

## 📦 Build Order

Recommended development milestone order (SRS v2 §11):

| Stage | What to Build | Demonstrable Output |
|---|---|---|
| **1 — Foundations** | Auth, DB schema, seed data, BKT engine | Login + course list |
| **2 — Offline Core** | IndexedDB sync, evaluator, quiz grading | Complete quiz offline |
| **3 — Adaptive Engine** | BKT updates, `recommendNextContent()` | Dashboard shows skill gaps |
| **4 — Cloud Sync** | Backoff queue, idempotent sync, LWW mastery | Sync works after offline session |
| **5 — AI Co-Pilot** | Gemini integration, 4-level graceful degradation | Chatbot works on/offline |
| **6 — Content Mesh** | BroadcastChannel → WebRTC, SHA-256 verify | Two devices share content on LAN |
| **7 — Reach Extensions** | Parent dashboard, SMS fallback, district admin | Multi-role demo |
| **8 — Hardening/Pilot** | Load tests, conflict tests, mesh tests | Verified with 2+ real devices |

---

## 🧪 Running Tests

### Python / Backend

```bash
# From inside kolibri/
uv run pytest kolibri/ -v

# With coverage report
uv run pytest kolibri/ --cov=kolibri --cov-report=html
```

### JavaScript / Frontend

```bash
pnpm run test

# Watch mode
pnpm run test:watch
```

### Linting

```bash
# Python (ruff)
uv run ruff check kolibri/
uv run ruff format kolibri/

# JavaScript (eslint)
pnpm run lint
```

---

## 📚 API Reference

EduBridge extends Kolibri's REST API with custom endpoints:

| Endpoint | Method | Description |
|---|---|---|
| `/api/auth/` | GET / POST | Authentication (login, logout, register) |
| `/api/content/` | GET | Browse and search learning content |
| `/api/logger/` | GET / POST | Student interaction and mastery logs |
| `/api/exams/` | GET / POST | Quizzes and assessments |
| `/api/lessons/` | GET / POST | Lesson plans |
| `/api/courses/` | GET / POST | Course management |
| `/api/attendance/` | GET / POST | Attendance tracking |
| `/api/notifications/` | GET | Analytics and notifications |
| `/api/edubridge_ai/` | POST | AI Co-Pilot chat (Gemini integration) |
| `/api/public/` | GET | **Stable** public API (backwards-compatible) |

> 📌 Only `/api/public/` endpoints are guaranteed to be stable across versions. Build external integrations against these only.

---

## 🔬 Module Status

| Module | File | Status |
|---|---|---|
| BKT Engine | `bkt.js` | ✅ Production-ready — verified BKT formulas |
| Evaluator | `evaluator.js` | ✅ Tested across all 4 question types |
| Sync | `sync.js` | ✅ Exponential backoff + idempotency verified |
| Content Mesh | `contentMesh.js` | ⚠️ BroadcastChannel real and testable; WebRTC/BLE is a labelled TODO |
| Encryption | `crypto.js` | ✅ AES-GCM via Web Crypto API |
| AI Service | `kolibri/core/ai_copilot/` | ✅ Real Gemini API calls; requires `GEMINI_API_KEY` |
| SHA-256 Checksum | `contentMesh.js` | ⚠️ Verified on URL string proxy; replace with file blob in production |
| SMS Notifications | Twilio stub | ⚠️ Configure `TWILIO_*` env vars to activate |

---

## 🤝 Contributing

Contributions are welcome! Here's how:

1. **Fork** this repository
2. **Create** a feature branch: `git checkout -b feature/your-feature-name`
3. **Commit** your changes following [Conventional Commits](https://www.conventionalcommits.org/): `git commit -m 'feat: add awesome feature'`
4. **Push** to your branch: `git push origin feature/your-feature-name`
5. **Open** a Pull Request

Please read the [Kolibri contribution guide](https://learningequality.org/contributing-to-our-open-code-base) for coding standards and workflow.

This project follows the [Kolibri Code of Conduct](kolibri/CODE_OF_CONDUCT.md). By participating, you agree to uphold a respectful and inclusive environment for everyone.

---

## 📄 License

EduBridge is licensed under the **MIT License**. See [LICENSE](kolibri/LICENSE) for full details.

The underlying Kolibri platform is also MIT-licensed by [Learning Equality](https://learningequality.org/).

---

<div align="center">

Built with ❤️ for rural learners everywhere

**[🐛 Report a Bug](https://github.com/Mugunthan-127/EduBridge/issues)** · **[💡 Request a Feature](https://github.com/Mugunthan-127/EduBridge/issues)** · **[💬 Community Forum](https://community.learningequality.org/)**

</div>
