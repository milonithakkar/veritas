// name=frontend/lib/api.ts
// Minimal API client for the frontend to call the Veritas backend.
// Uses NEXT_PUBLIC_API_URL (injected at build/runtime by Next) with a sensible default.

const BASE =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, "")
    : "http://localhost:8000";

async function safeJson(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function getFlags(limit = 50) {
  const res = await fetch(`${BASE}/flags?limit=${encodeURIComponent(limit)}`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`getFlags failed: ${res.status}`);
  return safeJson(res);
}

export async function getStats() {
  const res = await fetch(`${BASE}/stats`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`getStats failed: ${res.status}`);
  return safeJson(res);
}

export async function getPolicies() {
  const res = await fetch(`${BASE}/policies`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`getPolicies failed: ${res.status}`);
  return safeJson(res);
}
