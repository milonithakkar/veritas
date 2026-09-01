'use client'

import { useState } from 'react'
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

type View = 'Dashboard' | 'Response Monitor' | 'Model Health' | 'Cost Analytics' | 'Audit Trail'

const navItems: { label: View; icon: typeof Activity }[] = [
  { label: 'Dashboard', icon: BarChart3 },
  { label: 'Response Monitor', icon: Search },
  { label: 'Model Health', icon: Activity },
  { label: 'Cost Analytics', icon: DollarSign },
  { label: 'Audit Trail', icon: FileCheck2 },
]

const flags = [
  ['customer-chatbot-v3', 'PERFORMANCE', 'Factual grounding failed — warranty claim contradicts policy doc', '2 mins ago', 'Pending Review', 'critical'],
  ['loan-risk-model-v2', 'PERFORMANCE', 'Model drift detected — accuracy dropped from 91% to 74%', '8 mins ago', 'Pending Review', 'critical'],
  ['hr-screening-v1', 'RESPONSIBILITY', 'Potential gender bias detected in candidate assessment', '14 mins ago', 'Pending Review', 'warning'],
  ['sales-forecast-q3', 'COST', 'Response cost 3.2x above token budget threshold', '31 mins ago', 'Resolved', 'cost'],
  ['customer-chatbot-v3', 'RESPONSIBILITY', 'PII detected — email address in response', '47 mins ago', 'Resolved', 'warning'],
] as const

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
  return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={18} /></div><div className="stat-copy"><span>{label}</span><strong>{value}</strong>{trend && <small><TrendingUp size={12} /> 12.4% from yesterday</small>}</div></div>
}

function DashboardView({ setView }: { setView: (view: View) => void }) {
  return <>
    <header className="page-header"><div><p className="eyebrow">Operations overview <span className="live-dot" /> Live</p><h1>Good morning, analyst.</h1><p className="subtext">Here&apos;s what&apos;s happening across your AI systems today.</p></div><button className="icon-button" aria-label="Search"><Search size={18} /></button></header>
    <div className="stats-grid"><StatCard label="Responses Today" value="14,283" tone="purple" icon={TrendingUp} trend /><StatCard label="Flagged" value="47" tone="amber" icon={AlertTriangle} /><StatCard label="Blocked" value="3" tone="red" icon={ShieldCheck} /><StatCard label="Pass Rate" value="99.6%" tone="green" icon={Check} /></div>
    <div className="content-grid">
      <section className="panel"><SectionTitle>Recent Flags</SectionTitle><div className="flag-list">{flags.map(([model, category, desc, time, status, tone]) => <button className="flag-row" key={`${model}-${time}`} onClick={() => setView('Response Monitor')}><div className="flag-top"><strong>{model}</strong><Badge tone={tone}>{category}</Badge></div><p>{desc}</p><div className="flag-meta"><span>{time}</span><Badge tone={status === 'Resolved' ? 'safe' : 'pending'}>{status}</Badge></div></button>)}</div></section>
      <section className="panel"><SectionTitle>Model Health <span className="title-meta">4 monitored</span></SectionTitle><div className="model-list">{models.map(([name, accuracy, drift, tone]) => <button className="model-row" key={name} onClick={() => setView(name === 'loan-risk-model-v2' ? 'Model Health' : 'Dashboard')}><div className="model-name"><strong>{name}</strong>{name === 'loan-risk-model-v2' && <Badge tone="critical">DRIFT ALERT</Badge>}</div><div className="accuracy"><span>{accuracy}%</span><div className="progress"><i className={tone} style={{ width: `${accuracy}%` }} /></div></div><Badge tone={tone}>{drift}</Badge><ChevronRight size={15} className="row-chevron" /></button>)}</div><div className="panel-footer"><span>Last model sync 4 mins ago</span><button onClick={() => setView('Model Health')}>View all models <ChevronRight size={14} /></button></div></section>
    </div>
  </>
}

function ResponseMonitor() {
  const steps = [['Claim extracted:', "'warranty covers accidental damage'", 'safe', Check], ['Source retrieved:', 'warranty-policy-v4.2.pdf (confidence: 0.97)', 'safe', Check], ['Comparison:', 'AI claim CONTRADICTS source document Section 4.2', 'critical', X], ['Flag generated:', 'PERFORMANCE — Factual Grounding Failed', 'warning', AlertTriangle], ['Awaiting human review', '', 'neutral', Clock3]] as const
  return <><header className="page-header"><div><p className="eyebrow">Response Monitor / Case 1247</p><h1>Flagged Response #1247 <Badge tone="critical">PERFORMANCE — Factual Grounding Failed</Badge></h1><p className="subtext">customer-chatbot-v3 &nbsp;|&nbsp; August 14, 2026, 10:42 AM &nbsp;|&nbsp; Severity: HIGH</p></div></header><div className="response-grid"><section className="panel response-panel"><div className="panel-label critical-label">AI Response</div><div className="chat-bubble">Your warranty covers accidental damage, including drops and liquid spills. You can file a claim through our support portal.</div></section><section className="panel response-panel"><div className="panel-label safe-label">Source Truth</div><div className="source-doc"><span>Source file</span><strong>warranty-policy-v4.2.pdf</strong><p>This warranty explicitly excludes coverage for accidental damage, including but not limited to drops, liquid damage, and physical impact.</p><strong className="contradiction">CONTRADICTION DETECTED</strong></div></section></div><section className="panel reasoning"><SectionTitle>Reasoning Trail</SectionTitle><div className="steps">{steps.map(([lead, detail, tone, Icon], index) => <div className="step" key={index}><span className={`step-number ${tone}`}>{index + 1}</span><Icon size={16} className={tone} /><p><strong>{lead}</strong> {detail}</p></div>)}</div></section><div className="action-bar"><button className="action safe-action"><Check size={17} /> Approve — Mark as false alarm</button><button className="action primary-action"><Sparkles size={17} /> Edit — Correct and release</button><button className="action danger-action"><AlertTriangle size={17} /> Escalate — Route to compliance</button></div></>
}

function LineChart({ cost = false }: { cost?: boolean }) {
  const points = cost ? '5,90 70,63 135,76 200,42 265,28 330,69 395,91' : '5,28 40,28 75,30 110,32 145,43 180,52 215,61 250,68 285,75 320,82 355,88 395,92'
  return <div className="chart-wrap"><svg viewBox="0 0 400 150" role="img" aria-label={cost ? 'Daily spend versus budget line chart' : 'Accuracy over time line chart'} preserveAspectRatio="none"><line x1="0" y1={cost ? 72 : 64} x2="400" y2={cost ? 72 : 64} className="threshold" /><path d={`M ${points} L 395,145 L 5,145 Z`} className="chart-fill" /><polyline points={points} className={cost ? 'line purple-line' : 'line health-line'} /><polyline points={cost ? '' : '145,43 180,52 215,61 250,68 285,75 320,82 355,88 395,92'} className="line red-line" /></svg><div className="chart-axis"><span>{cost ? 'Mon' : 'Week 1'}</span><span>{cost ? 'Thu' : 'Week 6'}</span><span>{cost ? 'Sun' : 'Week 12'}</span></div></div>
}

function VolumeChart() { return <div className="chart-wrap"><div className="bars">{[1800, 2100, 1950, 2200, 1600, 800, 600].map((height, i) => <div className="bar-col" key={i}><i style={{ height: `${height / 24}%` }} className={i > 4 ? 'weekend' : ''} /><span>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}</span></div>)}</div></div> }

function ModelHealth() { return <><header className="page-header"><div><p className="eyebrow">Model Health / Performance diagnostics</p><h1>loan-risk-model-v2 <Badge tone="critical">DRIFT ALERT</Badge></h1><p className="subtext">Monitoring accuracy, response volume, and distribution shifts.</p></div></header><div className="charts-grid"><section className="panel chart-panel"><SectionTitle>Accuracy Over Time <span className="title-meta">Minimum threshold: 80%</span></SectionTitle><LineChart /></section><section className="panel chart-panel"><SectionTitle>Daily Response Volume <span className="title-meta">Last 7 days</span></SectionTitle><VolumeChart /></section></div><section className="panel drift-summary"><SectionTitle>Drift Summary</SectionTitle><div className="summary-grid"><div><span>Drift detected</span><strong className="warning-text">August 1, 2026</strong></div><div><span>Root cause</span><strong>Input data distribution shift in pricing feature</strong></div><div><span>Impact</span><strong className="critical-text">23% increase in false-negative risk assessments</strong></div><div><span>Recommendation</span><strong className="safe-text">Retrain with updated pricing data</strong></div></div></section><div className="button-row"><button className="action primary-action">Schedule Retrain</button><button className="action outline-action">Apply Calibration</button><button className="action neutral-action">Acknowledge &amp; Monitor</button></div></> }

function CostAnalytics() { const rows = [['customer-chatbot-v3', '42,841', '1,247', '$2,103', '+8%', 'warning'], ['loan-risk-model-v2', '18,293', '834', '$1,412', '+41% ⚠', 'critical'], ['sales-forecast-q3', '8,471', '2,103', '$892', '-3%', 'safe'], ['hr-screening-v1', '5,129', '612', '$440', '-12%', 'safe']] as const; return <><header className="page-header cost-header"><div><p className="eyebrow">Cost Analytics / August 10–16, 2026</p><h1>AI Spend This Week</h1><p className="spend-number">$4,847 <span>Budget: $4,000</span> <Badge tone="critical">21% Over Budget</Badge></p></div></header><section className="panel chart-panel spend-chart"><SectionTitle>Daily Spend vs Budget <span className="title-meta">Daily budget: $571</span></SectionTitle><LineChart cost /></section><section className="panel cost-table-panel"><SectionTitle>Cost by Model</SectionTitle><div className="table-scroll"><table><thead><tr><th>Model</th><th>Requests</th><th>Avg Tokens</th><th>Total Cost</th><th>vs Budget</th></tr></thead><tbody>{rows.map(([model, requests, tokens, total, delta, tone]) => <tr className={tone === 'critical' ? 'highlight-row' : ''} key={model}><td><strong>{model}</strong></td><td>{requests}</td><td>{tokens}</td><td>{total}</td><td><Badge tone={tone}>{delta}</Badge></td></tr>)}</tbody></table></div></section><div className="alert-card"><AlertTriangle size={18} /><p><strong>loan-risk-model-v2 is 41% over budget.</strong> Primary driver: redundant retrieval calls averaging 3.2 per request vs 1.0 expected.</p></div></> }

function Sidebar({ view, setView, open, setOpen }: { view: View; setView: (view: View) => void; open: boolean; setOpen: (open: boolean) => void }) { return <aside className={`sidebar ${open ? 'open' : ''}`}><div className="brand"><div className="brand-mark">V</div><div><strong>Veritas</strong><span>Find it first.</span></div><button className="close-sidebar" onClick={() => setOpen(false)} aria-label="Close menu"><PanelLeftClose size={17} /></button></div><div className="workspace"><span className="status-dot" /> Production <ChevronRight size={13} /></div><nav>{navItems.map(({ label, icon: Icon }) => <button key={label} className={view === label ? 'active' : ''} onClick={() => { setView(label); setOpen(false) }}><Icon size={18} /><span>{label}</span>{label === 'Response Monitor' && <em>3</em>}</button>)}</nav><div className="sidebar-bottom"><div className="user-chip"><div className="avatar">JD</div><div><strong>Jordan Davis</strong><span>Compliance Lead</span></div><ChevronRight size={14} /></div><span className="version">VERITAS OS · v2.4.1</span></div></aside> }

export default function Page() { const [view, setView] = useState<View>('Dashboard'); const [open, setOpen] = useState(false); return <div className="app-shell"><Sidebar view={view} setView={setView} open={open} setOpen={setOpen} /><button className="mobile-menu" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button><main className="main-content">{view === 'Dashboard' && <DashboardView setView={setView} />}{view === 'Response Monitor' && <ResponseMonitor />}{view === 'Model Health' && <ModelHealth />}{view === 'Cost Analytics' && <CostAnalytics />}{view === 'Audit Trail' && <><header className="page-header"><div><p className="eyebrow">Audit Trail</p><h1>Audit Trail</h1><p className="subtext">Traceability records will appear here as events are generated.</p></div></header><div className="empty-state"><FileCheck2 size={34} /><strong>No audit events to display</strong><span>All system actions are being monitored.</span></div></>}</main></div> }
