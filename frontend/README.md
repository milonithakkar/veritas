
# Frontend ↔ Backend Integration

This Next.js frontend reads the Veritas backend URL from `NEXT_PUBLIC_API_URL`.

## Local setup

1. Start backend (repository root):
   - `uvicorn core.gateway:app --host 0.0.0.0 --port 8000 --reload`
2. In `/home/runner/work/veritas/veritas/frontend`, create `.env.local`:
   - `NEXT_PUBLIC_API_URL=http://localhost:8000`
3. Install and run frontend:
   - `pnpm install`
   - `pnpm dev`

## API client

Use `/home/runner/work/veritas/veritas/frontend/lib/api.ts` for:
- `getFlags()`
- `getStats()`
- `getPolicies()`

No secrets are stored in the frontend files. `.env.example` only includes placeholders.
