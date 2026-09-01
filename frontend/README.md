# Frontend integration notes

This folder contains a Next.js (App Router) application. The frontend runs as a Next.js server/runtime and is expected to call the Veritas backend at runtime.

Local setup

1. Install dependencies (from repo root or inside frontend/ if using workspace):

```bash
# from repo root (pnpm workspace)
pnpm install

# or from frontend/
cd frontend
pnpm install
```

2. Create a local .env file for the frontend (not committed). You must set NEXT_PUBLIC_API_URL to point to your running Veritas backend, for example:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

If you want the frontend to call authenticated backend endpoints, set any needed env vars on the backend (OPENAI_API_KEY, GOOGLE_API_KEY) in the repo root .env.

3. Run frontend in dev mode:

```bash
cd frontend
pnpm dev
```

Notes

- A minimal API client was added at `frontend/lib/api.ts` to call `/flags`, `/stats`, and `/policies` on the backend using NEXT_PUBLIC_API_URL.
- The backend already enables permissive CORS for development, so the frontend can call it at localhost:8000 by default.
- Because this is a Next.js server-runtime app (not static export), the recommended local flow is to run the backend (FastAPI) on port 8000 and the frontend with `pnpm dev`. Adjust NEXT_PUBLIC_API_URL when deploying.
