/**
 * Veritas API Client
 *
 * Connects the frontend to the FastAPI backend via the Next.js rewrite proxy.
 * All calls go to /api/* which is proxied to the backend (default: localhost:8000).
 */

const API_BASE = '/api'

// --- Types matching the backend Pydantic models ---

export interface Stats {
  total: number
  flagged: number
  blocked: number
  passed: number
  pass_rate: number
}

export interface Flag {
  id: string
  timestamp: string
  use_case: string
  model_name: string
  verdict: string
  flag_type: string | null
  risk_dimension: string | null
  confidence_score: number | null
  reasoning: Record<string, unknown> | null
  source_reference: string | null
  reviewer_action: string | null
}

export interface Policy {
  use_case: string
  display_name: string
  geography: string
  max_latency_ms: number
  pii_action: string
  grounding_enabled: boolean
  require_human_review: boolean
}

export interface ChatRequest {
  use_case: string
  user_input: string
  system_prompt?: string
}

export interface ChatResponse {
  verdict: 'PASS' | 'FLAG' | 'BLOCK'
  response: string | null
  message: string
  event_id: string
  flags: Array<Record<string, unknown>>
  latency_ms: number
}

export interface ReviewRequest {
  event_id: string
  action: 'APPROVED' | 'EDITED' | 'ESCALATED'
  edited_response?: string
}

export interface ReviewResponse {
  success: boolean
  event_id: string
  action: string
  message: string
}

// --- Fetch helpers ---

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    throw new Error(`API GET ${path} failed: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API POST ${path} failed: ${res.status} ${res.statusText} — ${text}`)
  }
  return res.json()
}

// --- Public API functions ---

export async function fetchStats(): Promise<Stats> {
  return get<Stats>('/stats')
}

export async function fetchFlags(limit: number = 50): Promise<{ flags: Flag[] }> {
  return get<{ flags: Flag[] }>(`/flags?limit=${limit}`)
}

export async function fetchPolicies(): Promise<{ policies: Policy[] }> {
  return get<{ policies: Policy[] }>('/policies')
}

export async function sendChat(request: ChatRequest): Promise<ChatResponse> {
  return post<ChatResponse>('/chat', request)
}

export async function submitReview(request: ReviewRequest): Promise<ReviewResponse> {
  return post<ReviewResponse>('/review', request)
}

export async function checkHealth(): Promise<{
  service: string
  tagline: string
  version: string
  status: string
  available_use_cases: string[]
}> {
  return get('/').catch(() => ({
    service: 'Veritas',
    tagline: 'Find it first.',
    version: 'unknown',
    status: 'unreachable',
    available_use_cases: [],
  }))
}
