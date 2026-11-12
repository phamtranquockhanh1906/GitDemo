import type { ReactNode } from 'react'
import { STATUS_LABEL, type Status } from '@/lib/astro-data'

export function StatusBadge({ status, label }: { status: Status | 'info'; label?: string }) {
  return <span className={`st ${status}`}>{label ?? (status === 'info' ? 'INFO' : STATUS_LABEL[status])}</span>
}

export function PageHeader({ eyebrow, title, actions }: { eyebrow: string; title: string; actions?: ReactNode }) {
  return (
    <div className="page-h">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  )
}

export function Panel({ title, aside, children, className = '' }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`} aria-label={title}>
      <div className="panel-h">
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function RangeTabs<T extends string>({
  options,
  value,
  onChange,
  label,
  large,
}: {
  options: T[]
  value: T
  onChange: (v: T) => void
  label: string
  large?: boolean
}) {
  return (
    <div className={`tabs ${large ? 'lg' : ''}`} role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o} type="button" role="tab" aria-selected={value === o} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  )
}
