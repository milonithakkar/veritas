'use client'

import React, { useEffect } from 'react'

export type ToastItem = { id: string; message: string; tone?: 'info' | 'success' | 'error' }

export default function Toasts({ toasts, remove }: { toasts: ToastItem[]; remove: (id: string) => void }) {
  useEffect(() => {
    const timers = toasts.map(t => setTimeout(() => remove(t.id), 5000))
    return () => timers.forEach(t => clearTimeout(t))
  }, [toasts, remove])

  return (
    <div className="toasts-outer" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.tone || 'info'}`}>
          {t.message}
        </div>
      ))}
      <style jsx>{`
        .toasts-outer { position:fixed; right:16px; top:16px; z-index:70; display:flex; flex-direction:column; gap:8px }
        .toast { padding:8px 12px; border-radius:8px; color:#fff; min-width:180px }
        .toast-info { background:#374151 }
        .toast-success { background:#15803d }
        .toast-error { background:#dc2626 }
      `}</style>
    </div>
  )
}
