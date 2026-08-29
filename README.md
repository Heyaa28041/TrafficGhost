# 👻 TrafficGhost

**Transform real browser traffic and HAR recordings into realistic, dynamic local mock APIs with zero backend setup.**

> *"Record the backend once. Develop the frontend independently afterward."*

[![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-007ACC?logo=visual-studio-code)](https://marketplace.visualstudio.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?logo=typescript)](https://www.typescriptlang.org)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0-green?logo=node.js)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🌟 The Problem & The Solution

Frontend developers frequently face bottlenecks waiting for backend APIs to be designed, deployed, or unblocked in staging environments. Traditional mock servers require writing static JSON files by hand, manually updating routes, and failing to simulate dynamic path parameters, query pagination, latency delays, and critical error scenarios.

**TrafficGhost eliminates this dependency completely.**

Record real browser or staging interactions (or import a standard `.har` network capture), and TrafficGhost automatically analyzes captured traffic, discovers parameterized REST endpoints (`/api/users/:id`) and GraphQL operations, generates dynamic mock definitions, and spins up a local mock server on `http://localhost:4000`.

---

## 🚀 Core Features

- 📥 **HAR 1.2 Import**: Parse and normalize real network archives from Chrome DevTools, Firefox, Postman, or Charles Proxy.
- 🔴 **Authentic Browser Recording**: Capture live traffic directly from staging environments using the Chrome DevTools Protocol (CDP).
- 🧠 **Deterministic Traffic Analyzer**:
  - Infers dynamic path parameters (`/api/users/1`, `/api/users/2` → `/api/users/:id`).
  - Separates query parameters from route matching.
  - Automatically identifies pagination (`page`, `pageSize`, `limit`, `offset`).
- 🔮 **First-Class GraphQL Support**: Discovers operations on `/graphql` (queries, mutations, variables) and matches by operation name.
- ⚡ **Dynamic Mock Server**:
  - Interpolates dynamic path parameters in responses (e.g. requesting `/api/users/999` returns `{ "id": 999, ... }`).
  - Dynamically slices paginated collections according to `?page=X&limit=Y`.
  - CORS-enabled for seamless frontend integration with React, Vite, Next.js, Angular, and Vue.
- 🎭 **Scenario & Latency Engine**:
  - **Normal**: Authentic 200/201 responses.
  - **Slow Network**: Simulated 500ms – 1500ms latency to test skeleton loaders, spinners, and race conditions.
  - **Rate Limited (429)**: Returns 429 Too Many Requests with `Retry-After: 30`.
  - **Server Error (500)**: Simulates backend crashes and test retry mechanisms.
  - **Not Found (404)**: Simulates missing resources.
  - **Unauthorized (401)**: Simulates session expiration and auth guards.
  - **Empty Response**: Returns status 200 with empty collections `[]` or `{}` to test empty UI states.
  - **Per-Endpoint Overrides**: Set custom latency or error probability rates (e.g. 5% 500s, 95% 200s).
- 🛡️ **Privacy & Redaction**: All processing happens strictly locally on your machine. Automatically redacts `Authorization`, `Cookie`, `Set-Cookie`, and `X-API-Key` headers.
- 📊 **Rich Webview Dashboard**: Dark-themed, modern developer-tool UI embedded directly in VS Code.

---

## 📐 Architecture & Traffic Pipeline

```
Real Browser / Staging Interaction       HAR File (.har)
              │                                │
              ▼                                ▼
     Chrome DevTools Protocol             HAR 1.2 Parser
     (Network Domain capture)         (Header Redaction & Normalization)
              │                                │
              └───────────────┬────────────────┘
                              ▼
                   Normalized Traffic Stream
                     (CapturedRequest[])
                              │
                              ▼
                      Traffic Analyzer
              ┌───────────────┴───────────────┐
              ▼                               ▼
     REST Route Inferrer             GraphQL Operation Parser
    (:id, :uuid, pagination)        (Operation name, query, vars)
              │                               │
              └───────────────┬───────────────┘
                              ▼
                     Mock Schema Generator
                   (trafficghost/schema.json)
                              │
                              ▼
                   Dynamic Local Mock Server
                    (http://localhost:4000)
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
     Dynamic Params      Pagination       Scenario Engine
    (id: 999 replace)   (page/limit)   (Latency, 429, 500, 404)
                              │
                              ▼
                   Frontend Application
               (Vite / React / Next / Vue)
```

---

## ⚡ Quickstart Guide

### 1. Install & Open Your Frontend Project
Open your frontend application in VS Code.

### 2. Initialize TrafficGhost
Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run:
```
TrafficGhost: Initialize Project
```
This generates the `.env.trafficghost` file and local `trafficghost/` workspace directory.

### 3. Import HAR or Record Traffic
- **Import HAR**: Run `TrafficGhost: Import HAR` and pick any `.har` file (e.g. `demo/sample-traffic.har`).
- **Record Live**: Run `TrafficGhost: Start Recording`, navigate in Chrome, then run `TrafficGhost: Stop Recording`.

### 4. Start Local Mock Server
Run `TrafficGhost: Start Mock Server` or click **Start Server** in the TrafficGhost Activity Bar / Dashboard.
The mock server is live at:
```
http://localhost:4000
```

### 5. Connect Your Frontend
Point your frontend API client to the local mock server:
```env
# .env.local
VITE_API_URL=http://localhost:4000
REACT_APP_API_URL=http://localhost:4000
NEXT_PUBLIC_API_URL=http://localhost:4000
API_BASE_URL=http://localhost:4000
```

---

## 🎮 Step-by-Step Demonstration

The repository includes a ready-to-run interactive demo frontend in `demo/frontend/` and a sample HAR capture `demo/sample-traffic.har`.

### Step 1: Start the Mock Server
1. In VS Code, run `TrafficGhost: Import HAR` and select `demo/sample-traffic.har`.
2. Notice the Activity Bar updates instantly:
   - **Captured Traffic**: 47 requests
   - **REST Endpoints**: 11 inferred routes (including `/api/users/:id`, `/api/products/:id`)
   - **GraphQL Operations**: 4 operations (`GetUsers`, `GetUserById`, `CreateUser`, `GetProductCatalog`)
3. Run `TrafficGhost: Start Mock Server`.

### Step 2: Open the Demo Frontend
Serve the demo frontend:
```bash
node demo/frontend/server.js
```
Open `http://localhost:3000` in your browser.

### Step 3: Test Dynamic Path Parameters
In the demo app:
- Click **User 1**, **User 2**, or **User 3**.
- Click **User 999 (Unseen Dynamic ID)**: TrafficGhost dynamically matches `/api/users/:id` and responds with `{ "id": 999, ... }` while preserving authentic response structure!

### Step 4: Test Pagination
- Navigate to **Products**: Notice page 1 with 5 items.
- Click **Next Page**: TrafficGhost dynamically computes and returns page 2 items without static file duplication!

### Step 5: Test GraphQL Operations
- Navigate to **GraphQL Studio**:
- Click `GetUsers` or `GetUserById ($id: "1")` to see realistic GraphQL responses mapped to operation names.

### Step 6: Test Scenarios in Real-Time
Open the **TrafficGhost Dashboard** in VS Code:
1. **Switch to Slow Network**: Refresh the demo page to see loading skeletons and spinners visibly active during the 500ms–1500ms delay.
2. **Switch to Rate Limited (429)**: The frontend receives status 429 and displays a rate limit alert with retry button.
3. **Switch to Server Error (500)**: The frontend displays an error banner and demonstrates resilient retry logic.

---

## 📋 Available VS Code Commands

| Command | Description |
|---|---|
| `TrafficGhost: Initialize Project` | Sets up `trafficghost/` directory and `.env.trafficghost` |
| `TrafficGhost: Import HAR` | Imports and analyzes a `.har` network archive |
| `TrafficGhost: Start Recording` | Starts Chrome DevTools Protocol network recording session |
| `TrafficGhost: Stop Recording` | Stops browser recording and generates mock definitions |
| `TrafficGhost: Analyze Traffic` | Re-analyzes current captured traffic |
| `TrafficGhost: Generate Mock API` | Generates persistent mock JSON definitions |
| `TrafficGhost: Start Mock Server` | Starts local mock server on configured port |
| `TrafficGhost: Stop Mock Server` | Stops local mock server |
| `TrafficGhost: Open Traffic Dashboard` | Opens the full Webview Dashboard |
| `TrafficGhost: Open Endpoint` | Opens a specific endpoint in the Dashboard editor |
| `TrafficGhost: Configure Scenario` | Quick-pick menu for global scenarios |
| `TrafficGhost: Clear Recording` | Clears in-memory captures and recorded logs |

---

## ⚙️ Configuration Settings

Customize settings under `trafficghost.*` in your VS Code settings (`settings.json`):

```json
{
  "trafficghost.mockServer.port": 4000,
  "trafficghost.recording.autoSave": true,
  "trafficghost.latency.enabled": false,
  "trafficghost.latency.min": 100,
  "trafficghost.latency.max": 500,
  "trafficghost.redaction.enabled": true,
  "trafficghost.redaction.headers": [
    "authorization",
    "cookie",
    "set-cookie",
    "x-api-key",
    "apikey",
    "proxy-authorization"
  ]
}
```

---

## 🧪 Testing

Run the automated test suite covering HAR parsing, route parameter heuristics, query pagination, GraphQL operation extraction, latency injection, dynamic response substitution, and error simulation:

```bash
npm run test:src
```

All 22 unit and end-to-end integration tests execute against the compiled suite.

---

## 📦 Building the `.vsix` Package

```bash
npm run compile
npx @vscode/vsce package
```

Install the generated `.vsix` file in VS Code via:
```
code --install-extension trafficghost-1.0.0.vsix
```

---

## 📄 License

MIT © Google DeepMind / Antigravity Team
