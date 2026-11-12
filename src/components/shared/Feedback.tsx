import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
export function ErrorNotice({ error, retry }: { error: string; retry?: () => void }) {
  return error ? (
    <div role="alert" className="card p-3 my-3 text-sm text-red-700">
      {error}
      {retry && (
        <button className="btn btn-o ml-2 text-xs" onClick={retry}>
          Thử lại
        </button>
      )}
    </div>
  ) : null
}
export function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-50 bg-espresso/40 grid place-items-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="card pop p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}
export function Empty({
  title,
  description,
  action,
  onAction,
}: {
  title: string
  description: string
  action?: string
  onAction?: () => void
}) {
  return (
    <div className="card p-8 text-center">
      <div className="text-4xl mb-2">🍃</div>
      <h3 className="font-bold text-lg">{title}</h3>
      <p className="text-sm opacity-70 mt-1 mb-4">{description}</p>
      {action && (
        <button className="btn btn-p" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  )
}
export function Ring({ value, size = 64 }: { value: number; size?: number }) {
  return (
    <div
      className="rounded-full grid place-items-center shrink-0"
      style={{ width: size, height: size, background: `conic-gradient(#365c4a ${value * 3.6}deg,#e6ecdf 0)` }}
    >
      <div
        className="rounded-full bg-paper grid place-items-center font-extrabold text-forest"
        style={{ width: size - 12, height: size - 12 }}
      >
        {value}%
      </div>
    </div>
  )
}
