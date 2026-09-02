'use client'

import { useState } from 'react'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Check,
  ChevronRight,
  DollarSign,
  FileCheck2,
  Menu,
  MessageSquare,
  PanelLeftClose,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { useApi } from '@/lib/useApi'
import {
  fetchStats,
  fetchFlags,
  fetchPolicies,
  fetchModelHealth,
  fetchCostAnalytics,
  sendChat,
  submitReview,
  type Stats,
  type Flag,
  type Policy,
  type ChatResponse,
  type ModelHealthEntry,
  type CostAnalytics,
} from '@/lib/api'

type View = 'Dashboard' | 'Response Monitor' | 'Playground' | 'Model Health' | 'Cost Analytics' | 'Audit Trail'

const navItems: { label: View; icon: typeof Activity }[] = [
  { label: 'Dashboard', icon: BarChart3 },
  { label: 'Response Monitor', icon: Search },
  { label: 'Playground', icon: MessageSquare },
  { label: 'Model Health', icon: Activity },
  { label: 'Cost Analytics', icon: DollarSign },
  { label: 'Audit Trail', icon: FileCheck2 },
]

// --- Helpers ---

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function verdictTone(verdict: string): string {
  if (verdict === 'BLOCK') return 'critical'
  if (verdict === 'FLAG') return 'warning'
  return 'safe'
}

function dimensionLabel(dim: string | null): string {
  if (!dim) return 'UNKNOWN'
  return dim
}

// --- Reusable components ---

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="section-title"><h2>{children}</h2><span /></div>
}

function StatCard({ label, value, tone, icon: Icon }: { label: string; value: string; tone: string; icon: typeof Activity }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}><Icon size={18} /></div>
      <div className="stat-copy">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  )
}

function LoadingSpinner() {
  return (
    <div className="empty-state">
      <div style={{ width: 24, height: 24, border: '2px solid #493457', borderTopColor: '#b94bd2', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <strong>Connecting to Veritas API…</strong>
      <span>Loading live data from the backend.</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="alert-card" style={{ margin: '0 0 16px' }}>
      <AlertTriangle size={18} />
      <p>
        <strong>Backend connection error.</strong> {message}
        {onRetry && (
          <button onClick={onRetry} style={{ marginLeft: 10, background: 'none', border: '1px solid #a13c49', borderRadius: 4, padding: '3px 10px', color: '#ff8890', fontSize: 10 }}>
            Retry
          </button>
        )}
      </p>
    </div>
  )
}

function FlagRow({ flag, onClick }: { flag: Flag; onClick: () => void }) {
  const tone = verdictTone(flag.verdict)
  const status = flag.reviewer_action || 'Pending Review'
  const statusTone = flag.reviewer_action ? 'safe' : 'pending'

  return (
    <button className="flag-row" onClick={onClick}>
      <div className="flag-top">
        <strong>{flag.model_name || flag.use_case}</strong>
        <Badge tone={tone}>{dimensionLabel(flag.risk_dimension)}</Badge>
      </div>
      <p>{flag.flag_type || flag.verdict}</p>
      <div className="flag-meta">
        <span>{timeAgo(flag.timestamp)}</span>
        <Badge tone={statusTone}>{status}</Badge>
      </div>
    </button>
  )
}

// --- Dashboard ---

function DashboardView({ setView, setSelectedFlag }: { setView: (v: View) => void; setSelectedFlag: (f: Flag) => void }) {
  const stats = useApi<Stats>(fetchStats)
  const flags = useApi(fetchFlags)

  if (stats.loading && flags.loading) return <LoadingSpinner />

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Operations overview <span className="live-dot" /> Live</p>
          <h1>Good morning, analyst.</h1>
          <p className="subtext">Here&apos;s what&apos;s happening across your AI systems today.</p>
        </div>
        <button className="icon-button" aria-label="Search" onClick={() => { stats.refresh(); flags.refresh() }}>
          <Search size={18} />
        </button>
      </header>

      {stats.error && <ErrorBanner message={stats.error} onRetry={stats.refresh} />}

      <div className="stats-grid">
        <StatCard label="Total Responses" value={stats.data ? String(stats.data.total) : '—'} tone="purple" icon={TrendingUp} />
        <StatCard label="Flagged" value={stats.data ? String(stats.data.flagged) : '—'} tone="amber" icon={AlertTriangle} />
        <StatCard label="Blocked" value={stats.data ? String(stats.data.blocked) : '—'} tone="red" icon={ShieldCheck} />
        <StatCard label="Pass Rate" value={stats.data ? `${stats.data.pass_rate}%` : '—'} tone="green" icon={Check} />
      </div>

      <div className="content-grid">
        <section className="panel">
          <SectionTitle>Recent Flags</SectionTitle>
          {flags.error && <ErrorBanner message={flags.error} onRetry={flags.refresh} />}
          <div className="flag-list">
            {flags.data && flags.data.flags.length > 0 ? (
              flags.data.flags.slice(0, 5).map((flag) => (
                <FlagRow
                  key={flag.id}
                  flag={flag}
                  onClick={() => { setSelectedFlag(flag); setView('Response Monitor') }}
                />
              ))
            ) : flags.data ? (
              <p style={{ color: '#887b92', fontSize: 11, padding: '14px 0' }}>No flagged responses yet. Send a message in the Playground to generate events.</p>
            ) : null}
          </div>
        </section>

        <section className="panel">
          <SectionTitle>Quick Actions</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="action primary-action" onClick={() => setView('Playground')}>
              <MessageSquare size={17} /> Open Playground — Test a prompt
            </button>
            <button className="action outline-action" onClick={() => setView('Response Monitor')}>
              <Search size={17} /> View all flagged responses
            </button>
            <button className="action neutral-action" onClick={() => setView('Audit Trail')}>
              <FileCheck2 size={17} /> Browse audit trail
            </button>
          </div>
        </section>
      </div>
    </>
  )
}

// --- Response Monitor ---

function ResponseMonitor({ selectedFlag, onRefresh }: { selectedFlag: Flag | null; onRefresh: () => void }) {
  const flags = useApi(fetchFlags)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [editText, setEditText] = useState('')
  const [showEdit, setShowEdit] = useState(false)
  const [reviewResult, setReviewResult] = useState<string | null>(null)

  const activeFlag = selectedFlag || (flags.data?.flags?.[0] ?? null)

  const handleReview = async (action: 'APPROVED' | 'EDITED' | 'ESCALATED') => {
    if (!activeFlag) return
    setReviewLoading(true)
    setReviewResult(null)
    try {
      const res = await submitReview({
        event_id: activeFlag.id,
        action,
        edited_response: action === 'EDITED' ? editText : undefined,
      })
      setReviewResult(res.message)
      setShowEdit(false)
      onRefresh()
      flags.refresh()
    } catch (err) {
      setReviewResult(`Error: ${(err as Error).message}`)
    } finally {
      setReviewLoading(false)
    }
  }

  if (!selectedFlag && flags.loading) return <LoadingSpinner />

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Response Monitor{activeFlag ? ` / ${activeFlag.id.slice(0, 8)}` : ''}</p>
          <h1>
            {activeFlag ? `Flagged Response` : 'Response Monitor'}
            {activeFlag && <Badge tone={verdictTone(activeFlag.verdict)}>{activeFlag.verdict} — {dimensionLabel(activeFlag.risk_dimension)}</Badge>}
          </h1>
          {activeFlag && (
            <p className="subtext">
              {activeFlag.use_case} &nbsp;|&nbsp; {activeFlag.model_name} &nbsp;|&nbsp; {new Date(activeFlag.timestamp).toLocaleString()}
            </p>
          )}
        </div>
      </header>

      {flags.error && <ErrorBanner message={flags.error} onRetry={flags.refresh} />}
      {reviewResult && <div className="alert-card" style={{ margin: '0 0 16px', borderColor: '#43c98b', background: '#43c98b12', color: '#65e0a8' }}><Check size={18} /><p>{reviewResult}</p></div>}

      {activeFlag ? (
        <>
          <div className="response-grid">
            <section className="panel response-panel">
              <div className="panel-label critical-label">AI Response</div>
              <div className="chat-bubble">
                {activeFlag.reasoning && typeof activeFlag.reasoning === 'object' && 'ai_response' in (activeFlag.reasoning as Record<string, unknown>)
                  ? String((activeFlag.reasoning as Record<string, unknown>).ai_response)
                  : 'Response content stored in audit trail. Check the reasoning data for full details.'}
              </div>
            </section>
            <section className="panel response-panel">
              <div className="panel-label safe-label">Flag Details</div>
              <div className="source-doc">
                <span>Verdict</span>
                <strong>{activeFlag.verdict}</strong>
                <span style={{ marginTop: 8 }}>Flag type</span>
                <strong>{activeFlag.flag_type || 'N/A'}</strong>
                <span style={{ marginTop: 8 }}>Confidence score</span>
                <strong>{activeFlag.confidence_score != null ? `${(activeFlag.confidence_score * 100).toFixed(1)}%` : 'N/A'}</strong>
                {activeFlag.source_reference && (
                  <>
                    <span style={{ marginTop: 8 }}>Source reference</span>
                    <strong>{activeFlag.source_reference}</strong>
                  </>
                )}
                {activeFlag.reviewer_action && (
                  <>
                    <span style={{ marginTop: 8 }}>Reviewer action</span>
                    <strong style={{ color: '#65e0a8' }}>{activeFlag.reviewer_action}</strong>
                  </>
                )}
              </div>
            </section>
          </div>

          {showEdit && (
            <section className="panel" style={{ marginTop: 16 }}>
              <SectionTitle>Edit Response</SectionTitle>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                placeholder="Enter corrected response…"
                style={{
                  width: '100%', minHeight: 100, background: '#21153a', border: '1px solid #302247',
                  borderRadius: 5, padding: 12, color: '#f5f0fa', fontSize: 12, resize: 'vertical', fontFamily: 'inherit',
                }}
              />
            </section>
          )}

          <div className="action-bar">
            <button
              className="action safe-action"
              disabled={reviewLoading || !!activeFlag.reviewer_action}
              onClick={() => handleReview('APPROVED')}
            >
              <Check size={17} /> {reviewLoading ? 'Submitting…' : 'Approve — Mark as false alarm'}
            </button>
            <button
              className="action primary-action"
              disabled={reviewLoading || !!activeFlag.reviewer_action}
              onClick={() => {
                if (showEdit) { handleReview('EDITED') } else { setShowEdit(true); setEditText('') }
              }}
            >
              <Sparkles size={17} /> {showEdit ? 'Submit Edit' : 'Edit — Correct and release'}
            </button>
            <button
              className="action danger-action"
              disabled={reviewLoading || !!activeFlag.reviewer_action}
              onClick={() => handleReview('ESCALATED')}
            >
              <AlertTriangle size={17} /> Escalate — Route to compliance
            </button>
          </div>

          {!selectedFlag && flags.data && flags.data.flags.length > 1 && (
            <section className="panel" style={{ marginTop: 16 }}>
              <SectionTitle>All Flagged Responses <span className="title-meta">{flags.data.flags.length} total</span></SectionTitle>
              <div className="flag-list">
                {flags.data.flags.slice(1).map((flag) => (
                  <FlagRow key={flag.id} flag={flag} onClick={() => {}} />
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <div className="empty-state">
          <Search size={34} />
          <strong>No flagged responses</strong>
          <span>When AI responses are flagged or blocked, they&apos;ll appear here for review.</span>
        </div>
      )}
    </>
  )
}

// --- Playground (Chat) ---

function Playground() {
  const policies = useApi(fetchPolicies)
  const [useCase, setUseCase] = useState('')
  const [userInput, setUserInput] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ChatResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!useCase && policies.data?.policies?.[0]) {
    setUseCase(policies.data.policies[0].use_case)
  }

  const handleSend = async () => {
    if (!userInput.trim() || !useCase) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await sendChat({
        use_case: useCase,
        user_input: userInput,
        system_prompt: systemPrompt || undefined,
      })
      setResult(res)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Playground / Live evaluation</p>
          <h1>Test a Prompt <Badge tone="neutral">POST /chat</Badge></h1>
          <p className="subtext">Send a message through the Veritas gateway. The response will be evaluated in real time.</p>
        </div>
      </header>

      {policies.error && <ErrorBanner message={policies.error} onRetry={policies.refresh} />}

      <section className="panel" style={{ marginBottom: 16 }}>
        <SectionTitle>Configuration</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', color: '#8e7c9c', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Use Case / Policy</label>
            <select
              value={useCase}
              onChange={(e) => setUseCase(e.target.value)}
              style={{
                width: '100%', background: '#21153a', border: '1px solid #302247',
                borderRadius: 5, padding: '10px 12px', color: '#f5f0fa', fontSize: 12, fontFamily: 'inherit',
              }}
            >
              {policies.data?.policies?.map((p) => (
                <option key={p.use_case} value={p.use_case}>{p.display_name} ({p.use_case})</option>
              ))}
              {(!policies.data || policies.data.policies.length === 0) && (
                <option value="">No policies loaded</option>
              )}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', color: '#8e7c9c', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>System Prompt (optional)</label>
            <input
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="e.g. You are a helpful customer support agent…"
              style={{
                width: '100%', background: '#21153a', border: '1px solid #302247',
                borderRadius: 5, padding: '10px 12px', color: '#f5f0fa', fontSize: 12, fontFamily: 'inherit',
              }}
            />
          </div>
        </div>
      </section>

      <section className="panel" style={{ marginBottom: 16 }}>
        <SectionTitle>Your Message</SectionTitle>
        <div style={{ display: 'flex', gap: 10 }}>
          <textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Type a message to send through the Veritas gateway…"
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend() }}
            style={{
              flex: 1, minHeight: 80, background: '#21153a', border: '1px solid #302247',
              borderRadius: 5, padding: 12, color: '#f5f0fa', fontSize: 12, resize: 'vertical', fontFamily: 'inherit',
            }}
          />
          <button
            className="action primary-action"
            onClick={handleSend}
            disabled={loading || !userInput.trim()}
            style={{ flex: 'none', width: 52, padding: 0 }}
          >
            <Send size={18} />
          </button>
        </div>
      </section>

      {error && <ErrorBanner message={error} />}

      {loading && (
        <section className="panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#b94bd2' }}>
            <div style={{ width: 18, height: 18, border: '2px solid #493457', borderTopColor: '#b94bd2', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontSize: 12 }}>Evaluating through Veritas pipeline…</span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        </section>
      )}

      {result && (
        <>
          <section className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-label" style={{
              background: result.verdict === 'PASS' ? '#1d5144' : result.verdict === 'FLAG' ? '#5c4a1d' : '#6f2632',
              color: result.verdict === 'PASS' ? '#65e0a8' : result.verdict === 'FLAG' ? '#f1b658' : '#ff828a',
              borderBottom: `2px solid ${result.verdict === 'PASS' ? '#43c98b' : result.verdict === 'FLAG' ? '#e7a33e' : '#ef5360'}`,
            }}>
              Verdict: {result.verdict} — {result.latency_ms}ms
            </div>
            <div className="chat-bubble" style={{
              background: result.verdict === 'PASS' ? '#1a3d2e' : result.verdict === 'FLAG' ? '#3d3520' : '#4c202b',
              borderColor: result.verdict === 'PASS' ? '#2a5c42' : result.verdict === 'FLAG' ? '#6b5a2a' : '#783542',
            }}>
              {result.response || result.message}
            </div>
          </section>

          <section className="panel">
            <SectionTitle>Event Details</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div style={{ borderLeft: '2px solid #3a2a4b', paddingLeft: 12 }}>
                <span style={{ color: '#83768d', fontSize: 10 }}>Event ID</span>
                <strong style={{ display: 'block', fontSize: 11, marginTop: 4, wordBreak: 'break-all' }}>{result.event_id}</strong>
              </div>
              <div style={{ borderLeft: '2px solid #3a2a4b', paddingLeft: 12 }}>
                <span style={{ color: '#83768d', fontSize: 10 }}>Verdict</span>
                <strong style={{ display: 'block', fontSize: 12, marginTop: 4, color: result.verdict === 'PASS' ? '#43c98b' : result.verdict === 'FLAG' ? '#e7a33e' : '#ef5360' }}>
                  {result.verdict}
                </strong>
              </div>
              <div style={{ borderLeft: '2px solid #3a2a4b', paddingLeft: 12 }}>
                <span style={{ color: '#83768d', fontSize: 10 }}>Latency</span>
                <strong style={{ display: 'block', fontSize: 12, marginTop: 4 }}>{result.latency_ms}ms</strong>
              </div>
            </div>
            {result.flags.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <span style={{ color: '#83768d', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em' }}>Flags raised</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {result.flags.map((f, i) => (
                    <Badge key={i} tone="warning">{JSON.stringify(f).slice(0, 80)}</Badge>
                  ))}
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </>
  )
}

// --- Model Health (live data) ---

function MiniSparkline({ data, tone }: { data: number[]; tone: string }) {
  if (!data || data.length === 0) return null
  const w = 80, h = 24
  const step = w / Math.max(data.length - 1, 1)
  const points = data.map((v, i) => `${i * step},${h - v * h}`).join(' ')
  const color = tone === 'safe' ? '#43c98b' : tone === 'warning' ? '#e7a33e' : '#ef5360'
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function ModelHealth() {
  const health = useApi(fetchModelHealth)

  if (health.loading) return <LoadingSpinner />

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Model Health / Performance diagnostics</p>
          <h1>Model Health <Badge tone="neutral">GET /model-health</Badge></h1>
          <p className="subtext">Per-use-case accuracy, latency, and drift monitoring from real evaluation data.</p>
        </div>
        <button className="icon-button" onClick={() => health.refresh()} aria-label="Refresh">
          <Search size={18} />
        </button>
      </header>

      {health.error && <ErrorBanner message={health.error} onRetry={health.refresh} />}

      {health.data && health.data.models.length > 0 ? (
        <>
          {/* Model cards grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginBottom: 16 }}>
            {health.data.models.map((model) => (
              <section className="panel" key={model.use_case}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <strong style={{ fontSize: 14 }}>{model.use_case.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</strong>
                    <p style={{ color: '#8e7c9c', fontSize: 10, margin: '3px 0 0' }}>{model.model_name}</p>
                  </div>
                  <Badge tone={model.tone}>{model.drift} Drift</Badge>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.04em', color: model.pass_rate >= 90 ? '#43c98b' : model.pass_rate >= 75 ? '#e7a33e' : '#ef5360' }}>
                    {model.pass_rate}%
                  </span>
                  <MiniSparkline data={model.sparkline} tone={model.tone} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, fontSize: 11 }}>
                  <div style={{ borderLeft: '2px solid #3a2a4b', paddingLeft: 10 }}>
                    <span style={{ color: '#83768d', fontSize: 9 }}>Requests</span>
                    <strong style={{ display: 'block', marginTop: 2 }}>{model.total_requests}</strong>
                  </div>
                  <div style={{ borderLeft: '2px solid #3a2a4b', paddingLeft: 10 }}>
                    <span style={{ color: '#83768d', fontSize: 9 }}>Avg Latency</span>
                    <strong style={{ display: 'block', marginTop: 2 }}>{model.avg_latency_ms.toFixed(0)}ms</strong>
                  </div>
                  <div style={{ borderLeft: '2px solid #3a2a4b', paddingLeft: 10 }}>
                    <span style={{ color: '#83768d', fontSize: 9 }}>Confidence</span>
                    <strong style={{ display: 'block', marginTop: 2 }}>{model.avg_confidence != null ? `${(model.avg_confidence * 100).toFixed(0)}%` : '—'}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                  <Badge tone="safe">{model.passed} passed</Badge>
                  <Badge tone="warning">{model.flagged} flagged</Badge>
                  <Badge tone="critical">{model.blocked} blocked</Badge>
                  {model.pending_review > 0 && <Badge tone="pending">{model.pending_review} pending</Badge>}
                </div>

                {Object.keys(model.flag_types).length > 0 && (
                  <div style={{ marginTop: 12, borderTop: '1px solid #2a1c3c', paddingTop: 10 }}>
                    <span style={{ color: '#83768d', fontSize: 9, textTransform: 'uppercase', letterSpacing: '.08em' }}>Flag breakdown</span>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      {Object.entries(model.flag_types).map(([type, count]) => (
                        <Badge key={type} tone="neutral">{type}: {count}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            ))}
          </div>

          {/* Summary table */}
          <section className="panel">
            <SectionTitle>Health Summary <span className="title-meta">{health.data.models.length} use cases monitored</span></SectionTitle>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Use Case</th>
                    <th>Model</th>
                    <th>Pass Rate</th>
                    <th>Requests</th>
                    <th>Avg Latency</th>
                    <th>Drift</th>
                    <th>Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {health.data.models.map((model) => (
                    <tr key={model.use_case}>
                      <td><strong>{model.use_case.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</strong></td>
                      <td>{model.model_name}</td>
                      <td style={{ color: model.pass_rate >= 90 ? '#43c98b' : model.pass_rate >= 75 ? '#e7a33e' : '#ef5360' }}>
                        <strong>{model.pass_rate}%</strong>
                      </td>
                      <td>{model.total_requests}</td>
                      <td>{model.avg_latency_ms.toFixed(0)}ms</td>
                      <td><Badge tone={model.tone}>{model.drift}</Badge></td>
                      <td><MiniSparkline data={model.sparkline} tone={model.tone} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : health.data ? (
        <div className="empty-state">
          <Activity size={34} />
          <strong>No model health data yet</strong>
          <span>Send prompts through the Playground to generate evaluation data.</span>
        </div>
      ) : null}
    </>
  )
}

function CostAnalytics() {
  const cost = useApi<CostAnalytics>(fetchCostAnalytics)

  if (cost.loading) return <LoadingSpinner />

  return (
    <>
      <header className="page-header cost-header">
        <div>
          <p className="eyebrow">Cost Analytics / Live data</p>
          <h1>AI Spend Overview <Badge tone="neutral">GET /cost-analytics</Badge></h1>
          {cost.data && (
            <p className="spend-number">
              ${cost.data.estimated_total_cost.toFixed(2)}
              <span>{cost.data.total_tokens.toLocaleString()} tokens used across {cost.data.total_requests} requests</span>
            </p>
          )}
        </div>
        <button className="icon-button" onClick={() => cost.refresh()} aria-label="Refresh">
          <Search size={18} />
        </button>
      </header>

      {cost.error && <ErrorBanner message={cost.error} onRetry={cost.refresh} />}

      {cost.data && cost.data.by_use_case.length > 0 ? (
        <>
          {/* Daily token trend chart */}
          <section className="panel chart-panel spend-chart">
            <SectionTitle>Daily Token Usage <span className="title-meta">Last 7 days</span></SectionTitle>
            <TokenBarChart data={cost.data.daily_token_trend} />
          </section>

          {/* Stats cards */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <StatCard label="Total Requests" value={String(cost.data.total_requests)} tone="purple" icon={TrendingUp} />
            <StatCard label="Total Tokens" value={cost.data.total_tokens.toLocaleString()} tone="amber" icon={BarChart3} />
            <StatCard label="Avg Tokens/Request" value={String(cost.data.avg_tokens_per_request)} tone="green" icon={Activity} />
          </div>

          {/* Cost by use case table */}
          <section className="panel cost-table-panel" style={{ marginTop: 16 }}>
            <SectionTitle>Cost by Use Case</SectionTitle>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Use Case</th>
                    <th>Requests</th>
                    <th>Avg Tokens</th>
                    <th>Total Tokens</th>
                    <th>Est. Cost</th>
                    <th>7-Day Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {cost.data.by_use_case.map((item) => (
                    <tr key={item.use_case}>
                      <td><strong>{item.use_case.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</strong></td>
                      <td>{item.requests}</td>
                      <td>{item.avg_tokens}</td>
                      <td>{item.total_tokens.toLocaleString()}</td>
                      <td><strong>${item.estimated_cost.toFixed(2)}</strong></td>
                      <td><MiniTokenBars data={item.daily_tokens} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : cost.data ? (
        <div className="empty-state">
          <DollarSign size={34} />
          <strong>No cost data yet</strong>
          <span>Send prompts through the Playground to generate token usage data.</span>
        </div>
      ) : null}
    </>
  )
}

function TokenBarChart({ data }: { data: number[] }) {
  const max = Math.max(...data, 1)
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const today = new Date().getDay() // 0=Sun
  const labels = data.map((_, i) => {
    const dayIndex = (today - (data.length - 1 - i) + 7) % 7
    return days[dayIndex === 0 ? 6 : dayIndex - 1]
  })

  return (
    <div className="chart-wrap">
      <div className="bars">
        {data.map((val, i) => (
          <div className="bar-col" key={i}>
            <i style={{ height: `${Math.max((val / max) * 100, 2)}%` }} className={i >= data.length - 2 ? 'weekend' : ''} />
            <span>{labels[i]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MiniTokenBars({ data }: { data: number[] }) {
  const max = Math.max(...data, 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 20 }}>
      {data.map((val, i) => (
        <div
          key={i}
          style={{
            width: 6,
            height: `${Math.max((val / max) * 100, 5)}%`,
            background: i >= data.length - 2 ? '#67536f' : '#8b1fa9',
            borderRadius: '2px 2px 0 0',
            minHeight: 2,
          }}
        />
      ))}
    </div>
  )
}

// --- Audit Trail (live data) ---

function AuditTrail() {
  const flags = useApi(fetchFlags)

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Audit Trail</p>
          <h1>Audit Trail <Badge tone="neutral">GET /flags</Badge></h1>
          <p className="subtext">Every flagged and blocked event logged by the Veritas evaluation pipeline.</p>
        </div>
        <button className="icon-button" onClick={() => flags.refresh()} aria-label="Refresh">
          <Search size={18} />
        </button>
      </header>

      {flags.error && <ErrorBanner message={flags.error} onRetry={flags.refresh} />}

      {flags.loading ? (
        <LoadingSpinner />
      ) : flags.data && flags.data.flags.length > 0 ? (
        <section className="panel">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Event ID</th>
                  <th>Time</th>
                  <th>Use Case</th>
                  <th>Verdict</th>
                  <th>Risk</th>
                  <th>Flag Type</th>
                  <th>Reviewer</th>
                </tr>
              </thead>
              <tbody>
                {flags.data.flags.map((flag) => (
                  <tr key={flag.id}>
                    <td><strong>{flag.id.slice(0, 8)}…</strong></td>
                    <td>{timeAgo(flag.timestamp)}</td>
                    <td>{flag.use_case}</td>
                    <td><Badge tone={verdictTone(flag.verdict)}>{flag.verdict}</Badge></td>
                    <td>{flag.risk_dimension || '—'}</td>
                    <td>{flag.flag_type || '—'}</td>
                    <td>{flag.reviewer_action ? <Badge tone="safe">{flag.reviewer_action}</Badge> : <Badge tone="pending">Pending</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <div className="empty-state">
          <FileCheck2 size={34} />
          <strong>No audit events to display</strong>
          <span>Send a message through the Playground to generate evaluation events.</span>
        </div>
      )}
    </>
  )
}

// --- Sidebar ---

function Sidebar({ view, setView, open, setOpen, flagCount }: { view: View; setView: (v: View) => void; open: boolean; setOpen: (o: boolean) => void; flagCount: number }) {
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand">
        <div className="brand-mark">V</div>
        <div>
          <strong>Veritas</strong>
          <span>Find it first.</span>
        </div>
        <button className="close-sidebar" onClick={() => setOpen(false)} aria-label="Close menu"><PanelLeftClose size={17} /></button>
      </div>
      <div className="workspace"><span className="status-dot" /> Production <ChevronRight size={13} /></div>
      <nav>
        {navItems.map(({ label, icon: Icon }) => (
          <button
            key={label}
            className={view === label ? 'active' : ''}
            onClick={() => { setView(label); setOpen(false) }}
          >
            <Icon size={18} />
            <span>{label}</span>
            {label === 'Response Monitor' && flagCount > 0 && <em>{flagCount}</em>}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="user-chip">
          <div className="avatar">JD</div>
          <div>
            <strong>Jordan Davis</strong>
            <span>Compliance Lead</span>
          </div>
          <ChevronRight size={14} />
        </div>
        <span className="version">VERITAS OS · v2.4.1</span>
      </div>
    </aside>
  )
}

// --- Main Page ---

export default function Page() {
  const [view, setView] = useState<View>('Dashboard')
  const [open, setOpen] = useState(false)
  const [selectedFlag, setSelectedFlag] = useState<Flag | null>(null)

  // Fetch flag count for sidebar badge
  const flags = useApi(fetchFlags)
  const flagCount = flags.data?.flags?.filter(f => !f.reviewer_action).length ?? 0

  const handleRefresh = () => {
    flags.refresh()
  }

  return (
    <div className="app-shell">
      <Sidebar view={view} setView={setView} open={open} setOpen={setOpen} flagCount={flagCount} />
      <button className="mobile-menu" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
      <main className="main-content">
        {view === 'Dashboard' && <DashboardView setView={setView} setSelectedFlag={setSelectedFlag} />}
        {view === 'Response Monitor' && <ResponseMonitor selectedFlag={selectedFlag} onRefresh={handleRefresh} />}
        {view === 'Playground' && <Playground />}
        {view === 'Model Health' && <ModelHealth />}
        {view === 'Cost Analytics' && <CostAnalytics />}
        {view === 'Audit Trail' && <AuditTrail />}
      </main>
    </div>
  )
}
