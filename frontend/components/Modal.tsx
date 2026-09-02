'use client'

import React from 'react'

export default function Modal({ open, title, children, onClose }: { open: boolean; title?: string; children: React.ReactNode; onClose: () => void }) {
  if (!open) return null
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal" role="document">
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
      <style jsx>{`
        .modal-backdrop { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.5); z-index:60; }
        .modal { background:var(--panel-bg,#111827); padding:16px; border-radius:8px; width:min(720px,95%); box-shadow:0 10px 30px rgba(0,0,0,0.6); }
        .modal-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px }
        .modal-close { background:transparent; border:none; color:#fff; font-size:20px; cursor:pointer }
        .modal-body { color:var(--muted,#d1d5db) }
      `}</style>
    </div>
  )
}
