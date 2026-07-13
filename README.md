# EduBridge

Rural-first, offline-capable adaptive learning platform. Built for schools with intermittent internet.

---

## Zero-Investment Deployment Stack (SRS v2 §10)

| Layer | Service | Tier | Notes |
|---|---|---|---|
| Frontend | [Render Static Sites](https://render.com) | Free forever | Deploy from `frontend/dist` |
| Backend | [Render Web Service](https://render.com) | Free 750 hrs/mo | Spins down after 15 min idle; cold start ~30s |
| Database | [Supabase PostgreSQL](https://supabase.com) | Free 500 MB | Replace H2 driver config below |
| AI | [Gemini API](https://aistudio.google.com) | Free 15 RPM / 1M TPM | Set `GEMINI_API_KEY` env var |
| Media/CDN | [Cloudinary](https://cloudinary.com) | Free 25 GB bandwidth | For video content delivery |
| SMS fallback | Twilio trial credit | Trial (~$15) | Fallback-only per SRS v2; replace with email for zero cost |
| Auth | Self-hosted JWT | Free | Already implemented |

---

## Local Development

### Prerequisites
- Java 21 + Gradle (Backend)
- Node.js 18+ (Frontend)
- A Code Editor (e.g., VS Code or IntelliJ IDEA)

### Starting in your Code Editor (e.g., VS Code)

You will need to run the frontend and backend in separate terminal sessions.

**1. Start the Backend:**
1. Open the `backend` folder in your code editor or open a new terminal within your code editor.
2. Navigate to the backend directory:
   ```bash
   cd backend
   ```
3. Run the Spring Boot application:
   ```bash
   ./gradlew bootRun
   ```
   *(The backend will start on http://localhost:8080 with an H2 in-memory database. You can inspect the DB at http://localhost:8080/h2-console)*

**2. Start the Frontend:**
1. Open a **new, separate terminal tab/window** in your code editor.
2. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
3. Install dependencies and start the React dev server:
   ```bash
   npm install
   npm run dev
   ```
   *(The frontend will start on http://localhost:5173)*

---

## Production Deployment (Render + Supabase)

### 1. Database — Supabase
1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **Settings → Database → Connection String** and copy the JDBC URL
3. Set environment variables in Render:
   ```
   DB_URL=jdbc:postgresql://db.<project>.supabase.co:5432/postgres
   DB_USERNAME=postgres
   DB_PASSWORD=<your-supabase-password>
   ```

### 2. Backend — Render Web Service
1. Connect your GitHub repo at [render.com](https://render.com)
2. Create a **Web Service** with:
   - **Root Directory**: `backend`
   - **Build Command**: `./gradlew bootJar`
   - **Start Command**: `java -jar build/libs/edubridge-0.0.1-SNAPSHOT.jar`
   - **Environment**: Add `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `GEMINI_API_KEY`, `JWT_SECRET`
3. Render auto-deploys on every push to `main`.

### 3. Frontend — Render Static Site
1. Create a **Static Site** with:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
2. Set environment variable: `VITE_API_BASE_URL=https://<your-backend>.onrender.com`

> **Free-tier note**: Render's free web service sleeps after 15 min of inactivity.
> The first request after sleep takes ~30s. This is acceptable for a pilot; upgrade to
> the $7/mo plan for always-on production.

---

## Build Order (SRS v2 §11 — Dependency-Ordered)

| Stage | What to build | Demonstrable output |
|---|---|---|
| **1 Foundations** | Auth, DB schema, seed data, BKT engine | Login + course list |
| **2 Offline Core** | IndexedDB sync, evaluator, quiz grading | Complete quiz offline |
| **3 Adaptive Engine** | BKT updates, recommendNextContent | Dashboard shows skill gaps |
| **4 Cloud Sync** | Backoff queue, idempotent sync, LWW mastery | Sync works after offline session |
| **5 AI Co-Pilot** | Gemini integration, 4-level degradation | Chatbot works on/offline |
| **6 Local Content Mesh** | BroadcastChannel → WebRTC, SHA-256 verify | Two tabs/devices share content |
| **7 Reach Extensions** | Parent dashboard, SMS fallback, district admin | Multi-role demo |
| **8 Hardening/Pilot** | Load tests, conflict tests, mesh tests | Verified with 2+ devices |

---

## Code Honesty Notes (matches README.md from EduBridge_Core.zip)

| Module | Status |
|---|---|
| `bkt.js` | ✅ Production-ready — verified BKT formulas |
| `evaluator.js` | ✅ Tested across all 4 question types |
| `sync.js` | ✅ Exponential backoff + idempotency verified |
| `contentMesh.js` | ⚠️ BroadcastChannel transport is real and testable; WebRTC/BLE wiring is a labelled TODO |
| `crypto.js` | ✅ AES-GCM via Web Crypto API |
| `GeminiService.java` | ✅ Real Gemini API calls; requires `GEMINI_API_KEY` |
| SHA-256 checksum in contentMesh | ⚠️ Verified on URL string proxy; replace with actual file blob in production |
| SMS notifications | ⚠️ Twilio stub; configure `TWILIO_*` env vars to activate |

---

## Environment Variables Reference

### Backend (`application-prod.properties`)
```
spring.datasource.url=${DB_URL}
spring.datasource.username=${DB_USERNAME}
spring.datasource.password=${DB_PASSWORD}
gemini.api.key=${GEMINI_API_KEY}
jwt.secret=${JWT_SECRET}
jwt.expiration=86400000
```

### Frontend (`.env.production`)
```
VITE_API_BASE_URL=https://<your-backend>.onrender.com
```
