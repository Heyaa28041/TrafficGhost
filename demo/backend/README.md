# ⚡ Nexus API — Realistic SaaS Mock Backend

A production-grade mock API server built with **Node.js + Express + GraphQL** designed specifically to generate realistic SaaS API traffic for **TrafficGhost** browser recording, dynamic route inference, stateful CRUD replay, error injection, and resilience testing.

---

## 🚀 Quick Start

### 1. Installation

```bash
cd demo/backend
npm install
```

### 2. Run the Server

```bash
npm start
```

The server will start on **`http://localhost:4000`**.

### 3. Verify Health

```bash
# PowerShell
Invoke-RestMethod -Uri "http://localhost:4000/health" -Method Get

# cURL
curl http://localhost:4000/health
```

---

## 📋 API Endpoints Reference

### 🏥 Health & System

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server health, uptime, and database counts |
| `GET` | `/api/status` | Service status descriptor |
| `GET` | `/api/health` | Alternate health check endpoint |
| `POST` | `/api/demo/reset` | Resets in-memory database to initial seed data |

---

### 🔐 Authentication

| Method | Endpoint | Description | Payload / Headers |
|---|---|---|---|
| `POST` | `/api/auth/login` | Authenticate user & get token | `{"email": "admin@nexus.test", "password": "password123"}` |
| `POST` | `/api/login` | Frontend-compatible login route | `{"username": "alice@example.com", "password": "correct-password"}` |
| `POST` | `/api/auth/logout` | Invalidate current session | — |
| `GET` | `/api/auth/me` | Fetch authenticated user profile | Header: `Authorization: Bearer <token>` |
| `GET` | `/api/me` | Shorthand profile endpoint | Header: `Authorization: Bearer <token>` |
| `POST` | `/api/auth/refresh` | Refresh authentication token | — |

---

### 👥 Users (Stateful CRUD)

| Method | Endpoint | Query / Body Params | Description |
|---|---|---|---|
| `GET` | `/api/users` | `?page=1&limit=10&search=alice&role=admin&status=active&department=Engineering` | List users with pagination and filters |
| `GET` | `/api/users/:id` | — | Retrieve single user by ID |
| `POST` | `/api/users` | `{"name": "...", "email": "...", "role": "...", "department": "..."}` | Create a new user (returns 201 + Location header) |
| `PUT` | `/api/users/:id` | `{"name": "...", "email": "...", "role": "..."}` | Replace user record |
| `PATCH` | `/api/users/:id` | `{"role": "Staff Engineer"}` | Partially update user fields |
| `DELETE` | `/api/users/:id` | — | Remove user from in-memory state |

---

### 📦 Products (Stateful CRUD)

| Method | Endpoint | Query / Body Params | Description |
|---|---|---|---|
| `GET` | `/api/products` | `?category=Electronics&search=keyboard&minPrice=10&maxPrice=100&page=1&limit=5&sort=price_asc` | Filtered & paginated product catalog |
| `GET` | `/api/products/:id` | — | Retrieve product by ID |
| `POST` | `/api/products` | `{"name": "...", "price": 99.99, "category": "..."}` | Create a new product (returns 201) |
| `PATCH` | `/api/products/:id` | `{"price": 89.99, "stock": 120}` | Update product pricing / inventory |
| `DELETE` | `/api/products/:id` | — | Delete product |

---

### 🛒 Orders (Stateful CRUD & Nested Data)

| Method | Endpoint | Query / Body Params | Description |
|---|---|---|---|
| `GET` | `/api/orders` | `?status=completed&userId=1&page=1&limit=10` | Filtered list of customer orders |
| `GET` | `/api/orders/:id` | — | Fetch order by order ID (e.g. `ORD-001` or `1001`) |
| `POST` | `/api/orders` | `{"userId": 1, "items": [{"productId": 201, "quantity": 2}]}` | Create new order (auto-calculates total) |
| `PATCH` | `/api/orders/:id` | `{"status": "shipped"}` | Update order status / tracking |
| `DELETE` | `/api/orders/:id` | — | Cancel / remove order |

---

### 📊 Analytics & Reporting

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/analytics/overview` | High-level metrics: MRR, ARR, active users, orders, conversion rate |
| `GET` | `/api/analytics/revenue` | Time-series revenue breakdown by month and product category |
| `GET` | `/api/analytics/users` | User growth cohorts, retention rates, department distributions |
| `GET` | `/api/analytics/activity` | Recent audit events, logins, and system actions |

---

### 🔔 Notifications

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/notifications` | List notifications (supports `?unreadOnly=true&limit=5`) |
| `PATCH` | `/api/notifications/:id/read` | Mark single notification as read |
| `PATCH` | `/api/notifications/read-all` | Mark all notifications as read |
| `DELETE` | `/api/notifications/:id` | Remove a notification |

---

### 🔍 Global Search

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/search?q=<term>` | Unified search across Users, Products, and Orders |

---

### 🔮 GraphQL (`POST /graphql`)

Supports standard GraphQL queries and mutations against the live in-memory store:

```graphql
# Query Users
query GetUsers {
  users(limit: 5, role: "admin") {
    id
    name
    email
    role
    department
  }
}

# Query Single User
query GetUser($id: ID!) {
  user(id: $id) {
    id
    name
    email
    role
  }
}

# Query Products
query GetProducts {
  products(category: "Electronics") {
    id
    name
    price
    stock
    sku
  }
}

# Mutation: Create User
mutation CreateNewUser {
  createUser(name: "Devon Miles", email: "devon@nexus.test", role: "DevOps Engineer", department: "Infrastructure") {
    id
    name
    email
    role
  }
}
```

---

### 💥 Error Simulation (For TrafficGhost Testing)

Explicit endpoints to test status code capture and UI error state rendering:

| Method | Endpoint | Status Code | Error Code |
|---|---|---|---|
| `GET` | `/api/demo/errors/400` | 400 | `BAD_REQUEST` |
| `GET` | `/api/demo/errors/401` | 401 | `UNAUTHORIZED` |
| `GET` | `/api/demo/errors/403` | 403 | `FORBIDDEN` |
| `GET` | `/api/demo/errors/404` | 404 | `NOT_FOUND` |
| `GET` | `/api/demo/errors/409` | 409 | `CONFLICT` |
| `GET` | `/api/demo/errors/422` | 422 | `UNPROCESSABLE_ENTITY` |
| `GET` | `/api/demo/errors/429` | 429 | `RATE_LIMITED` (with `Retry-After: 30`) |
| `GET` | `/api/demo/errors/500` | 500 | `INTERNAL_SERVER_ERROR` |
| `GET` | `/api/demo/errors/502` | 502 | `BAD_GATEWAY` |
| `GET` | `/api/demo/errors/503` | 503 | `SERVICE_UNAVAILABLE` (with `Retry-After: 60`) |
| `GET` | `/api/demo/errors/504` | 504 | `GATEWAY_TIMEOUT` |
| `GET` | `/api/demo/errors/:code` | `:code` | Any status code (100–599) |

---

### ⏱️ Latency & Chaos Testing

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/demo/slow/:milliseconds` | Delays response by `:milliseconds` (e.g. `/api/demo/slow/1500`, capped at 10,000ms) |
| `GET` | `/api/demo/flaky` | Randomly returns either 200 OK or 500 Internal Error (supports `?failureRate=0.5`) |
| `GET` | `/api/demo/timeout` | Delays for 12,000ms to test frontend fetch abort/timeout handlers |
| `GET` | `/api/demo/rate-limit` | Allows 5 requests per 30 seconds; returns 429 when exceeded |
| `GET` | `/api/demo/rate-limit/reset` | Resets the demo rate-limiting counters |

---

## 💻 PowerShell Test Examples

### 1. Health Check
```powershell
Invoke-RestMethod -Uri "http://localhost:4000/health" -Method Get | ConvertTo-Json
```

### 2. Login Authentication
```powershell
$body = @{ email = "admin@nexus.test"; password = "password123" } | ConvertTo-Json
$auth = Invoke-RestMethod -Uri "http://localhost:4000/api/auth/login" -Method Post -Body $body -ContentType "application/json"
$token = $auth.token
Write-Host "Token: $token"
```

### 3. Authenticated Profile Request
```powershell
$headers = @{ Authorization = "Bearer $token" }
Invoke-RestMethod -Uri "http://localhost:4000/api/auth/me" -Headers $headers -Method Get | ConvertTo-Json
```

### 4. Stateful User Lifecycle (POST → GET → PATCH → DELETE → GET)
```powershell
# Create user
$newUser = @{
    name = "Samantha Wright"
    email = "samantha.wright@nexus.test"
    role = "Senior Cloud Architect"
    department = "Infrastructure"
} | ConvertTo-Json
$created = Invoke-RestMethod -Uri "http://localhost:4000/api/users" -Method Post -Body $newUser -ContentType "application/json"
$newId = $created.id
Write-Host "Created User ID: $newId"

# Fetch created user
Invoke-RestMethod -Uri "http://localhost:4000/api/users/$newId" -Method Get | ConvertTo-Json

# Patch user
$patch = @{ role = "Principal Cloud Architect" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:4000/api/users/$newId" -Method Patch -Body $patch -ContentType "application/json" | ConvertTo-Json

# Delete user
Invoke-RestMethod -Uri "http://localhost:4000/api/users/$newId" -Method Delete | ConvertTo-Json

# Verify 404 on deleted user
try {
    Invoke-RestMethod -Uri "http://localhost:4000/api/users/$newId" -Method Get
} catch {
    Write-Host "Confirmed 404 Not Found: $($_.Exception.Message)"
}
```

### 5. GraphQL Query Execution
```powershell
$gqlBody = @{
    query = "query { users(limit: 3) { id name email role } products(limit: 2) { id name price } }"
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:4000/graphql" -Method Post -Body $gqlBody -ContentType "application/json" | ConvertTo-Json
```

### 6. Error & Latency Simulation
```powershell
# Test 500 Error
try {
    Invoke-RestMethod -Uri "http://localhost:4000/api/demo/errors/500" -Method Get
} catch {
    Write-Host "Simulated 500 Error Caught: $($_.Exception.Message)"
}

# Test 1500ms Latency
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$res = Invoke-RestMethod -Uri "http://localhost:4000/api/demo/slow/1500" -Method Get
$sw.Stop()
Write-Host "Response received in $($sw.ElapsedMilliseconds)ms: $($res.message)"
```
