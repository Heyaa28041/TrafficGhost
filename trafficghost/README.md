# 👻 TrafficGhost

**Reconstruct your local API from real traffic. No backend needed.**

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

---

## The Problem

Frontend developers constantly wait for backend APIs.

- The backend isn't ready yet.
- The staging environment is down.
- You need to test error states that are hard to trigger.
- You need to work offline or on a plane.

## The Solution

TrafficGhost watches your real backend, learns its behavior, and reconstructs a local API that replaces it.

**Watch → Capture → Mock → Develop → Break it intentionally → Survive.**

---

## How It Works

```
Real Backend
     ↓
📡 CAPTURE TRAFFIC (HAR import or live proxy)
     ↓
TrafficGhost Analyzer
  • Detects 17 API endpoints
  • Finds 4 dynamic routes (/users/:id)
  • Finds 2 pagination patterns (?page=N)
     ↓
🚀 START MOCK
     ↓
localhost:4000
     ↓
Your Frontend (works without the real backend)
     ↓
Dashboard: introduce latency, 500s, 429s, chaos
```

---

## Features

| Feature | Status |
|---------|--------|
| HAR 1.2 import | ✅ P0 |
| Live HTTP proxy capture | ✅ P1 |
| Dynamic route detection (`:id`) | ✅ P0 |
| Pagination detection (`?page=N`) | ✅ P0 |
| Mock generation | ✅ P0 |
| Local mock server (Fastify, `:4000`) | ✅ P0 |
| VS Code extension (two-button UX) | ✅ P0 |
| Latency simulation (0–5s) | ✅ P0 |
| Error injection (404/429/500) | ✅ P0 |
| Chaos mode | ✅ P1 |
| Live request log | ✅ P1 |
| Dashboard with API explorer | ✅ P1 |
| Endpoint tester | ✅ P1 |
| Demo presets (Normal/Slow/Flaky/Down) | ✅ P1 |
| Demo frontend (React) | ✅ P0 |
| `.env.local` auto-generation | ✅ P1 |
| GraphQL detection | 🔜 P2 |
| CLI | 🔜 P2 |

---

## Quick Start

### Prerequisites

- Node.js 18+
- VS Code 1.80+

### 1. Install dependencies

```bash
# Core engine
cd core
npm install
npm run build

# VS Code extension
cd ../extension
npm install
npm run compile

# Demo frontend
cd ../demo/frontend
npm install
```

### 2. Launch the VS Code extension

Open `trafficghost/` in VS Code, then press **F5** to launch the Extension Development Host.

Or install the `.vsix` package:

```bash
cd extension
npm run package
code --install-extension trafficghost-1.0.0.vsix
```

### 3. Run the demo

```bash
# Terminal 1 — start demo frontend
cd demo/frontend
npm run dev
# Opens http://localhost:5173
```

Open http://localhost:5173 in your browser.

---

## Demo Walkthrough (Hackathon Script)

### Step 1 — Open the frontend

Browser shows Users, Products, Orders tabs loading from the real backend.

### Step 2 — Click 📡 CAPTURE TRAFFIC

Select `demo/demo.har` when prompted.

TrafficGhost shows:
```
✓ 16 requests imported
✓ 10 APIs detected
✓ 4 dynamic routes
✓ 2 paginated endpoints
```

### Step 3 — Click 🚀 START MOCK

TrafficGhost:
1. Generates mock definitions
2. Starts local server on `http://localhost:4000`
3. Opens the dashboard

### Step 4 — Frontend runs from mock

The demo frontend already points to `http://localhost:4000` via `.env.local`.

### Step 5 — Disconnect the real backend

The frontend keeps working! TrafficGhost is serving all responses.

### Step 6 — Dashboard: simulate failures

- **Slow**: Latency slider → 2000ms → frontend shows loading spinners
- **500 errors**: 500 slider → 50% → frontend shows error panels  
- **Rate limit**: 429 slider → 30% → frontend shows rate-limit state
- **Normal**: Click the "Normal" preset → everything recovers instantly

---

## Project Structure

```
trafficghost/
├── core/                    # Node.js engine (TypeScript)
│   └── src/
│       ├── har/             # HAR parser
│       ├── analyzer/        # Endpoint + pagination detection
│       ├── generator/       # Mock definition generator
│       ├── behavior/        # Latency + error injection
│       ├── matcher/         # Request → mock matching
│       ├── server/          # Mock API server (Fastify, :4000)
│       ├── proxy/           # HTTP capture proxy (:7777)
│       ├── api/             # Control API (:4001)
│       └── storage/         # .trafficghost/ JSON storage
│
├── extension/               # VS Code extension
│   └── src/
│       ├── extension.ts     # Activation + command registration
│       ├── sidebar/         # Two-button sidebar webview
│       ├── panels/          # Full dashboard panel
│       └── services/        # Engine HTTP client
│
├── demo/
│   ├── demo.har             # 16-request realistic demo HAR
│   └── frontend/            # React + Vite demo app
│
├── README.md
├── LICENSE                  # Apache 2.0
└── THIRD_PARTY_NOTICES.md
```

---

## Ports

| Service | Port | Purpose |
|---------|------|---------|
| Mock API | `:4000` | What your frontend calls |
| Control API | `:4001` | Extension ↔ Engine comms |
| HTTP Proxy | `:7777` | Live traffic capture |
| Demo Frontend | `:5173` | Vite dev server |

---

## Running Tests

```bash
cd core
npm test
```

Tests cover:
- HAR parsing (valid, empty, malformed, base64)
- Endpoint detection (static, dynamic, UUID, keywords)
- Pagination detection (page, offset, cursor)
- Request matching (exact, parameterized, priority)
- Integration: HAR → analyze → generate → HTTP request

---

## Third-Party Licenses

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

---

## License

Apache 2.0 — see [LICENSE](LICENSE).

---

*Built for hackathon. Inspired by the idea that frontend developers shouldn't need a backend to do their best work.*
