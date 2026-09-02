'use client'

import { useState, useEffect } from 'react'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Check,
  ChevronRight,
  Clock3,
  DollarSign,
  FileCheck2,
  Menu,
  PanelLeftClose,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'

import { getFlags, postReview } from '../lib/api'

type View = 'Dashboard' | 'Response Monitor' | 'Model Health' | 'Cost Analytics' | 'Audit Trail'

const navItems: { label: View; icon: typeof Activity }[] = [
  { label: 'Dashboard', icon: BarChart3 },
  { label: 'Response Monitor', icon: Search },
  { label: 'Model Health', icon: Activity },
  { label: 'Cost Analytics', icon: DollarSign },
  { label: 'Audit Trail', icon: FileCheck2 },
]

// Keep models static for now
const models = [
  ['customer-chatbot-v3', 94, 'Low', 'safe'],
  ['loan-risk-model-v2', 74, 'High', 'critical'],
  ['sales-forecast-q3', 88, 'Medium', 'warning'],
  ['hr-screening-v1', 91, 'Low', 'safe'],
] as const

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="section-title"><h2>{children}</h2><span /></div>
}

function StatCard({ label, value, tone, icon: Icon, trend }: { label: string; value: string; tone: string; icon: typeof Activity; trend?: boolean }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={18} /></div><div className="stat-copy"><span>{label}</span><strong>{value}</strong>{trend && <small><TrendingUp size={12} /></small>}</div></div>
}

function DashboardView({ setView, flagsState, onApprove, onEdit, onEscalate, onOpenFlag }: { setView: (view: View) => void; flagsState: any[]; onApprove: (id: string) => void; onEdit: (id: string) => void; onEscalate: (id: string) => void; onOpenFlag: (flag: any) => void }) {
  return <>
    <header className="page-header"><div><p className="eyebrow">Operations overview <span className="live-dot" /> Live</p><h1>Good morning, analyst.</h1><p className="subtext">Here's what's happening across monitored models.</p></div></header>
    <div className="stats-grid"><StatCard label="Responses Today" value="14,283" tone="purple" icon={TrendingUp} trend /><StatCard label="Flagged" value={String(flagsState.length)} tone="amber" icon={AlertTriangle} /><StatCard label="Blocked" value="3" tone="red" icon={ShieldCheck} /><StatCard label="Pass Rate" value="99.6%" tone="green" icon={Check} /></div>
    <div className="content-grid">
      <section className="panel"><SectionTitle>Recent Flags</SectionTitle>
        <div className="flag-list">
          {flagsState.map((flag: any) => {
            const model = flag.model_name || flag.use_case || 'unknown'
            const category = flag.risk_dimension || flag.flag_type || flag.verdict || 'UNKNOWN'
            // Try to pick a human-friendly description from reasoning if present
            const desc = (flag.reasoning && (flag.reasoning.response_preview || (flag.reasoning.flags && flag.reasoning.flags[0] && flag.reasoning.flags[0].detail))) || flag.flag_type || 'No detail available'
            const time = flag.timestamp ? new Date(flag.timestamp).toLocaleString() : 'n/a'
            const status = flag.reviewer_action || flag.verdict || 'Pending'
            const tone = (flag.reasoning && flag.reasoning.flags && flag.reasoning.flags[0] && flag.reasoning.flags[0].severity) === 'CRITICAL' ? 'critical' : (flag.verdict === 'BLOCK' ? 'critical' : (flag.verdict === 'FLAG' ? 'warning' : 'safe'))
            return (
              <div className="flag-row" key={flag.id} onClick={() => onOpenFlag(flag)} role="button" tabIndex={0}>
                <div className="flag-top">
                  <div className="flag-meta">
                    <strong>{model}</strong>
                    <small className="muted">{category} • {time}</small>
                  </div>
                </div>
                <p className="flag-desc">{desc}</p>
                <div className="flag-actions">
                  <Badge tone={tone}>{status}</Badge>
                  <div className="action-buttons">
                    <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); onApprove(flag.id); }}>Approve</button>
                    <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); onEdit(flag.id); }}>Edit</button>
                    <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); onEscalate(flag.id); }}>Escalate</button>
                  </div>
                </div>
              </div>
            )
          })}
          {flagsState.length === 0 && <div className="empty">No flagged responses</div>}
        </div>
      </section>
      <section className="panel"><SectionTitle>Model Health <span className="title-meta">4 monitored</span></SectionTitle>
        <div className="model-list">{models.map(([name, accuracy, drift, tone]) => <div className="model-row" key={name}><div className="model-name">{name}</div><div className="accuracy"><span>{accuracy}%</span></div></div>)}</div>
      </section>
    </div>
  </>
}

function ResponseMonitor({ flag, onApprove, onEdit, onEscalate }: { flag: any | null; onApprove: (id: string) => void; onEdit: (id: string) => void; onEscalate: (id: string) => void }) {
  if (!flag) return <div className="panel"><SectionTitle>Response Monitor</SectionTitle><div>Select a flagged response from the dashboard to view details.</div></div>

  const reasoning = flag.reasoning || {}
  return <>
    <header className="page-header"><div><p className="eyebrow">Response Monitor</p><h1>Flagged Response <Badge tone={(flag.verdict==='BLOCK'?'critical':(flag.verdict==='FLAG'?'warning':'safe'))}>{flag.verdict}</Badge></h1></div></header>
    <div className="panel"><SectionTitle>Details</SectionTitle>
      <div className="detail-row"><strong>Model / Use Case</strong><div>{flag.model_name || flag.use_case}</div></div>
      <div className="detail-row"><strong>Timestamp</strong><div>{flag.timestamp}</div></div>
      <div className="detail-row"><strong>User Input</strong><div className="mono">{(reasoning.user_input_preview) || 'n/a'}</div></div>
      <div className="detail-row"><strong>AI Response</strong><div className="mono">{(reasoning.response_preview) || flag.ai_response || 'n/a'}</div></div>
      <div className="detail-row"><strong>Flags</strong><div>{(reasoning.flags && reasoning.flags.length>0) ? reasoning.flags.map((f:any,i:number)=><div key={i}>{f.dimension}: {f.type} — {f.detail}</div>) : 'None'}</div></div>
      <div className="panel-actions">
        <button className="btn" onClick={() => onApprove(flag.id)}>Approve</button>
        <button className="btn" onClick={() => onEdit(flag.id)}>Edit</button>
        <button className="btn" onClick={() => onEscalate(flag.id)}>Escalate</button>
      </div>
    </div>
  </>
}

function LineChart({ cost = false }: { cost?: boolean }) {
  const points = cost ? '5,90 70,63 135,76 200,42 265,28 330,69 395,91' : '5,28 40,28 75,30 110,32 145,43 180,52 215,61 250,68 285,75 320,82 355,88 395,92'
  return <div className="chart-wrap"><svg viewBox="0 0 400 150" role="img" aria-label={cost ? 'Daily spend versus budget line chart' : 'Accuracy over time line chart'} preserveAspectRatio="none"><polyline points={points} fill="none" stroke="#7c3aed" strokeWidth="2"/></svg></div>
}

function VolumeChart() { return <div className="chart-wrap"><div className="bars">{[1800, 2100, 1950, 2200, 1600, 800, 600].map((height, i) => <div className="bar-col" key={i}><i style={{ height: `${height / 30}px` }} /></div>)}</div></div> }

function ModelHealth() { return <><header className="page-header"><div><p className="eyebrow">Model Health / Performance diagnostics</p><h1>loan-risk-model-v2 <Badge tone="critical">DRIFT ALERT</Badge></h1></div></header></>
}

function CostAnalytics() { const rows = [['customer-chatbot-v3', '42,841', '1,247', '$2,103', '+8%', 'warning'], ['loan-risk-model-v2', '18,293', '834', '$1,412', '+41% ⚠', 'critical'], ['sales-forecast-q3', '6,432', '279', '$432', '-2%', 'safe']]; return <section className="panel"><SectionTitle>Cost Analytics</SectionTitle><div className="table">{rows.map(r => <div key={r[0] as string} className="row"><div>{r[0]}</div><div>{r[3]}</div></div>)}</div></section> }

function Sidebar({ view, setView, open, setOpen, onProfileToggle }: { view: View; setView: (view: View) => void; open: boolean; setOpen: (open: boolean) => void; onProfileToggle: () => void }) { return <aside className={`sidebar ${open ? 'open' : ''}`}><div className="brand"><div className="brand-mark">V</div><div className="brand-name">Veritas</div></div><nav>{navItems.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${view===label ? 'active' : ''}`} onClick={() => setView(label)}><Icon size={16} /><span>{label}</span></button>)}</nav><div className="sidebar-bottom"><div className="user-chip" onClick={onProfileToggle} role="button" tabIndex={0}><div className="avatar">JD</div><div className="user-meta"><div className="user-name">JD</div><div className="user-role">Analyst</div></div></div></div></aside> }

export default function Page() {
  const [view, setView] = useState<View>('Dashboard')
  const [open, setOpen] = useState(false)
  const [flagsState, setFlagsState] = useState<any[]>([])
  const [selectedFlag, setSelectedFlag] = useState<any | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)

  useEffect(() => {
    let mounted = true
    getFlags(50).then(res => {
      if (!mounted) return
      const flags = (res && res.flags) ? res.flags : []
      setFlagsState(flags)
    }).catch(err => {
      console.error('Failed to load flags', err)
      setFlagsState([])
    })
    return () => { mounted = false }
  }, [])

  async function handleApprove(id: string) {
    try {
      await postReview(id, 'APPROVED')
      setFlagsState(prev => prev.map(f => f.id === id ? { ...f, reviewer_action: 'APPROVED' } : f))
      if (selectedFlag && selectedFlag.id === id) setSelectedFlag({ ...selectedFlag, reviewer_action: 'APPROVED' })
    } catch (e) {
      console.error(e)
      alert('Approve failed')
    }
  }

  async function handleEdit(id: string) {
    const edited = window.prompt('Edit the response (this will be saved):')
    if (edited === null) return
    try {
      await postReview(id, 'EDITED', edited)
      setFlagsState(prev => prev.map(f => f.id === id ? { ...f, reviewer_action: 'EDITED' } : f))
      if (selectedFlag && selectedFlag.id === id) setSelectedFlag({ ...selectedFlag, reviewer_action: 'EDITED', ai_response: edited })
    } catch (e) {
      console.error(e)
      alert('Edit failed')
    }
  }

  async function handleEscalate(id: string) {
    try {
      await postReview(id, 'ESCALATED')
      setFlagsState(prev => prev.map(f => f.id === id ? { ...f, reviewer_action: 'ESCALATED' } : f))
      if (selectedFlag && selectedFlag.id === id) setSelectedFlag({ ...selectedFlag, reviewer_action: 'ESCALATED' })
    } catch (e) {
      console.error(e)
      alert('Escalate failed')
    }
  }

  function openFlag(flag: any) {
    setSelectedFlag(flag)
    setView('Response Monitor')
  }

  function toggleProfile() {
    setProfileOpen(p => !p)
  }

  return <div className="app-shell"><Sidebar view={view} setView={setView} open={open} setOpen={setOpen} onProfileToggle={toggleProfile} /><main className="main-content">{view === 'Dashboard' && <DashboardView setView={setView} flagsState={flagsState} onApprove={handleApprove} onEdit={handleEdit} onEscalate={handleEscalate} onOpenFlag={openFlag} />}{view === 'Response Monitor' && <ResponseMonitor flag={selectedFlag} onApprove={handleApprove} onEdit={handleEdit} onEscalate={handleEscalate} />}{view === 'Model Health' && <ModelHealth />}{view === 'Cost Analytics' && <CostAnalytics />}{view === 'Audit Trail' && <div className="panel"><SectionTitle>Audit Trail</SectionTitle><div>Coming soon</div></div>}</main>{profileOpen && <aside className="profile-drawer"><div className="panel"><h3>Profile</h3><div className="user-meta"><div className="user-name">JD</div><div className="user-role">Analyst</div></div><button className="btn" onClick={() => setProfileOpen(false)}>Close</button></div></aside>}</div>
}
