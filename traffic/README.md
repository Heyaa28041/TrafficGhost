# TrafficGhost Fake Frontend

A deliberately incomplete React + Vite frontend for a live TrafficGhost developer-tool demonstration.

## What is intentionally incomplete

- GET /api/users is integrated.
- POST /api/users is not integrated.
- DELETE /api/users/:id is not integrated.
- Retry behavior is minimal.
- The frontend explicitly handles several backend failure scenarios so TrafficGhost can be demonstrated against them.

## Run

```bash
npm install
npm run dev
```

The app expects TrafficGhost's local API at:

http://localhost:4000

## Live demo scenarios

Use TrafficGhost to change the API behavior:

- Normal / 200: users appear.
- Slow response: loading state remains visible.
- 404: red "Resource not found" state.
- 429: red "Too many requests" state.
- 500: red "Unable to load users" state with database connection detail.
- Network failure: red "Unable to connect" state.

Return TrafficGhost to normal and use "Try Again" or "Refresh" to demonstrate recovery.
