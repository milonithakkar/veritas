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

import { getFlags, postReview, getStats } from '../lib/api'
import Modal from '../components/Modal'
import Toasts from '../components/Toasts'

type View = 'Dashboard' | 'Response Monitor' | 'Model Health' | 'Cost Analytics' | 'Audit Trail'

const navItems: { label: View; icon: typeof Activity }[] = [
  { label: 'Dashboard', icon: BarChart3 },
  { label: 'Response Monitor', icon: Search },
  { label: 'Model Health', icon: Activity },
  { label: 'Cost Analytics', icon: DollarSign },
  { label: 'Audit Trail', icon: FileCheck2 },
]

const models = [
  ['customer-chatbot-v3', 'Customer Chatbot v3', 94, 'Low', 'safe'],
  ['loan-risk-model-v2', 'Loan Decision Model v2', 74, 'High', 'critical'],
  ['sales-forecast-q3', 'Sales Forecast Q3', 88, 'Medium', 'warning'],
  ['hr-screening-v1', 'HR Screening v1', 91, 'Low', 'safe'],
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

function LineChart({ points, label }: { points: string; label?: string }) {
  return <div className="chart-wrap small"><svg viewBox="0 0 400 150" role="img" aria-label={label || 'line chart'} preserveAspectRatio="none"><polyline points={points} fill="none" stroke="#7c3aed" strokeWidth="2"/></svg></div>
}

function CostAnalytics({ costs }: { costs: { model:string; responses:number; flags:number; spend:number; change:string }[] }) {
  return <section className="panel"><SectionTitle>Cost Analytics</SectionTitle>
    <div className="cost-grid">
      <div className="cost-chart"><LineChart points={'5,90 70,63 135,76 200,42 265,28 330,69 395,91'} label="Daily spend" /></div>
      <div className="cost-table">
        <table>
          <thead><tr><th>Model</th><th>Responses</th><th>Flags</th><th>Spend</th><th>Change</th></tr></thead>
          <tbody>
            {costs.map(c=> (
              <tr key={c.model}><td>{c.model}</td><td>{c.responses.toLocaleString()}</td><td>{c.flags}</td><td>${c.spend.toFixed(2)}</td><td>{c.change}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    <style jsx>{`
      .cost-grid{display:grid;grid-template-columns:1fr 360px;gap:16px}
      table{width:100%;border-collapse:collapse}
      th,td{padding:8px;text-align:left;border-bottom:1px solid rgba(255,255,255,0.04)}
    `}</style>
  </section>
}

function Sidebar({ view, setView, open, setOpen, onProfileToggle }: { view: View; setView: (view: View) => void; open: boolean; setOpen: (open: boolean) => void; onProfileToggle: () => void }) {
  return <aside className={`sidebar ${open ? 'open' : ''}`}><div className="brand"><div className="brand-mark">V</div><div className="brand-name">Veritas</div></div><nav>{navItems.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${view===label ? 'active' : ''}`} onClick={() => setView(label)}><Icon size={16} /><span>{label}</span></button>)}</nav><div className="sidebar-bottom"><div className="user-chip" onClick={onProfileToggle} role="button" tabIndex={0}><div className="avatar">JD</div><div className="user-meta"><div className="user-name">JD</div><div className="user-role">Analyst</div></div></div></div></aside>
}

export default function Page() {
  const [view, setView] = useState<View>('Dashboard')
  const [open, setOpen] = useState(false)
  const [flagsState, setFlagsState] = useState<any[]>([])
  const [selectedFlag, setSelectedFlag] = useState<any | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editText, setEditText] = useState('')
  const [editTarget, setEditTarget] = useState<string | null>(null)
  const [loadingIds, setLoadingIds] = useState<Record<string, boolean>>({})
  const [toasts, setToasts] = useState<{id:string;message:string;tone?:'info'|'success'|'error'}[]>([])
  const [costs, setCosts] = useState<{ model:string; responses:number; flags:number; spend:number; change:string }[]>([])

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

    getStats().then(s=>{
      // dummy costs sample from stats
      setCosts([
        { model: 'Customer Chatbot v3', responses: 42841, flags: 47, spend: 2103.12, change: '+8%' },
        { model: 'Loan Decision Model v2', responses: 18293, flags: 12, spend: 1412.05, change: '+41%' },
        { model: 'Sales Forecast Q3', responses: 6432, flags: 2, spend: 432.00, change: '-2%' },
      ])
    }).catch(()=>{})

    return () => { mounted = false }
  }, [])

  function pushToast(message: string, tone: 'info'|'success'|'error'='info'){
    const id = crypto.randomUUID()
    setToasts(t=>[...t, {id,message,tone}])
  }
  function removeToast(id:string){ setToasts(t=>t.filter(x=>x.id!==id)) }

  async function doAction(id:string, action:'APPROVED'|'EDITED'|'ESCALATED', edited_response?:string|null){
    try{
      setLoadingIds(s=>({...s,[id]:true}))
      await postReview(id, action, edited_response ?? null)
      setFlagsState(prev => prev.map(f => f.id === id ? { ...f, reviewer_action: action } : f))
      if (selectedFlag && selectedFlag.id===id) setSelectedFlag({...selectedFlag, reviewer_action: action, ai_response: edited_response ?? selectedFlag.ai_response})
      pushToast(`${action} recorded`, 'success')
    }catch(e:any){
      console.error(e)
      pushToast(`Action failed: ${e?.message||'unknown'}`,'error')
    }finally{ setLoadingIds(s=>{ const n={...s}; delete n[id]; return n }) }
  }

  function handleApprove(id:string){ doAction(id,'APPROVED') }
  function handleEscalate(id:string){ doAction(id,'ESCALATED') }
  function openEditModal(id:string, current?:string){ setEditTarget(id); setEditText(current||''); setEditModalOpen(true) }
  async function submitEdit(){ if(!editTarget) return; await doAction(editTarget,'EDITED', editText); setEditModalOpen(false); setEditTarget(null); setEditText('') }

  function openFlag(flag:any){ setSelectedFlag(flag); setView('Response Monitor') }
  function toggleProfile(){ setProfileOpen(p=>!p) }

  return <div className="app-shell">
    <Sidebar view={view} setView={setView} open={open} setOpen={setOpen} onProfileToggle={toggleProfile} />
    <main className="main-content">
      {view==='Dashboard' && <>
        <DashboardHeader />
        <div className="stats-grid"><StatCard label="Responses Today" value="14,283" tone="purple" icon={TrendingUp} trend /><StatCard label="Flagged" value={String(flagsState.length)} tone="amber" icon={AlertTriangle} /><StatCard label="Blocked" value="3" tone="red" icon={ShieldCheck} /><StatCard label="Pass Rate" value="99.6%" tone="green" icon={Check} /></div>
        <div className="content-grid">
          <section className="panel"><SectionTitle>Recent Flags</SectionTitle>
            <div className="flag-list">
              {flagsState.map((flag:any)=>{
                const model = flag.model_name || flag.use_case || 'unknown'
                const category = flag.risk_dimension || flag.flag_type || flag.verdict || 'UNKNOWN'
                const desc = (flag.reasoning && (flag.reasoning.response_preview || (flag.reasoning.flags && flag.reasoning.flags[0] && flag.reasoning.flags[0].detail))) || flag.flag_type || 'No detail available'
                const time = flag.timestamp ? new Date(flag.timestamp).toLocaleString() : 'n/a'
                const status = flag.reviewer_action || flag.verdict || 'Pending'
                const tone = (flag.reasoning && flag.reasoning.flags && flag.reasoning.flags[0] && flag.reasoning.flags[0].severity) === 'CRITICAL' ? 'critical' : (flag.verdict==='BLOCK'?'critical':(flag.verdict==='FLAG'?'warning':'safe'))
                return (
                  <div className="flag-row" key={flag.id} onClick={()=>openFlag(flag)} role="button" tabIndex={0}>
                    <div className="flag-top"><div className="flag-meta"><strong>{model}</strong><small className="muted">{category} • {time}</small></div></div>
                    <p className="flag-desc">{desc}</p>
                    <div className="flag-actions"><Badge tone={tone}>{status}</Badge>
                      <div className="action-buttons">
                        <button className="btn btn-sm" disabled={!!loadingIds[flag.id]} onClick={(e)=>{e.stopPropagation(); handleApprove(flag.id)}}>{loadingIds[flag.id]?'...':'Approve'}</button>
                        <button className="btn btn-sm" disabled={!!loadingIds[flag.id]} onClick={(e)=>{e.stopPropagation(); openEditModal(flag.id, (flag.reasoning && flag.reasoning.response_preview) || flag.ai_response)}}>{loadingIds[flag.id]?'...':'Edit'}</button>
                        <button className="btn btn-sm" disabled={!!loadingIds[flag.id]} onClick={(e)=>{e.stopPropagation(); handleEscalate(flag.id)}}>{loadingIds[flag.id]?'...':'Escalate'}</button>
                      </div>
                    </div>
                  </div>
                )
              })}
              {flagsState.length===0 && <div className="empty">No flagged responses</div>}
            </div>
          </section>
          <CostAnalytics costs={costs} />
        </div>
      </>}

      {view==='Response Monitor' && <ResponseMonitorComponent flag={selectedFlag} onApprove={handleApprove} onEdit={(id:string, current?:string)=>openEditModal(id,current)} onEscalate={handleEscalate} />}
      {view==='Model Health' && <ModelHealth />}
      {view==='Cost Analytics' && <CostAnalytics costs={costs} />}
      {view==='Audit Trail' && <div className="panel"><SectionTitle>Audit Trail</SectionTitle><div>Coming soon</div></div>}
    </main>

    {profileOpen && <aside className="profile-drawer"><div className="panel"><h3>Profile</h3><div className="user-meta"><div className="user-name">JD</div><div className="user-role">Analyst</div></div><button className="btn" onClick={()=>setProfileOpen(false)}>Close</button></div></aside>}

    <Modal open={editModalOpen} title="Edit AI Response" onClose={()=>setEditModalOpen(false)}>
      <div>
        <textarea value={editText} onChange={(e)=>setEditText(e.target.value)} style={{width:'100%',minHeight:120}} />
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
          <button className="btn" onClick={()=>setEditModalOpen(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={submitEdit}>Save</button>
        </div>
      </div>
    </Modal>

    <Toasts toasts={toasts} remove={(id:string)=>removeToast(id)} />

    <style jsx>{`
      .app-shell{display:flex}
      .main-content{flex:1;padding:20px}
      .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
      .content-grid{display:grid;grid-template-columns:2fr 1fr;gap:16px}
      .flag-list{display:flex;flex-direction:column;gap:12px}
      .flag-row{background:linear-gradient(180deg,rgba(255,255,255,0.02),transparent);padding:12px;border-radius:8px;cursor:pointer}
      .flag-desc{color:var(--muted,#cbd5e1)}
      .flag-actions{display:flex;justify-content:space-between;align-items:center;margin-top:8px}
      .action-buttons{display:flex;gap:8px}
      .btn{padding:6px 10px;border-radius:6px;background:rgba(255,255,255,0.03);border:none;color:#fff;cursor:pointer}
      .btn-primary{background:#7c3aed}
      .btn[disabled]{opacity:0.6;cursor:not-allowed}
      .profile-drawer{position:fixed;right:16px;top:16px;width:300px}
    `}</style>
  </div>
}

function DashboardHeader(){
  return <header className="page-header"><div><p className="eyebrow">Operations overview <span className="live-dot" /> Live</p><h1>Good morning, analyst.</h1><p className="subtext">Overview of model performance, cost and flagged responses.</p></div></header>
}

function ResponseMonitorComponent({ flag, onApprove, onEdit, onEscalate }: { flag:any|null; onApprove:(id:string)=>void; onEdit:(id:string, current?:string)=>void; onEscalate:(id:string)=>void }){
  if(!flag) return <div className="panel"><SectionTitle>Response Monitor</SectionTitle><div>Select a flagged response from the dashboard to view details.</div></div>
  const reasoning = flag.reasoning || {}
  return <>
    <header className="page-header"><div><p className="eyebrow">RESPONSE MONITOR</p><h1>Flagged Response <Badge tone={(flag.verdict==='BLOCK'?'critical':(flag.verdict==='FLAG'?'warning':'safe'))}>{flag.verdict}</Badge></h1></div></header>
    <div className="panel">
      <div className="detail-row"><strong>Model / Use Case</strong><div>{flag.model_name || flag.use_case}</div></div>
      <div className="detail-row"><strong>Timestamp</strong><div>{flag.timestamp}</div></div>
      <div className="detail-row"><strong>Claim extracted</strong><div className="mono">{(reasoning.user_input_preview) || 'n/a'}</div></div>
      <div className="detail-row"><strong>Source retrieved</strong><div className="mono">{(reasoning.available_actions && reasoning.available_actions.length>0) ? 'See sources' : 'None'}</div></div>
      <div className="detail-row"><strong>Comparison</strong><div className="mono">{(reasoning.response_preview) || flag.ai_response || 'n/a'}</div></div>
      <div className="panel-actions" style={{marginTop:12}}>
        <button className="btn" onClick={()=>onApprove(flag.id)}>Approve</button>
        <button className="btn" onClick={()=>onEdit(flag.id, (reasoning.response_preview||flag.ai_response))}>Edit</button>
        <button className="btn" onClick={()=>onEscalate(flag.id)}>Escalate</button>
      </div>
    </div>
  </>
}

function ModelHealth(){ return <div className="panel"><SectionTitle>Model Health</SectionTitle><div>Model diagnostics and historical charts coming soon.</div></div> }
