'use client'

import { CircleCheck, Siren } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AiAssessmentView } from './modules/ai-assessment-view'
import { AnalyticsView } from './modules/analytics-view'
import { DashboardView } from './modules/dashboard-view'
import { MissionsView } from './modules/missions-view'
import { MonitoringView } from './modules/monitoring-view'
import { ProfileView } from './modules/profile-view'
import { Sidebar, type ModuleId } from './sidebar'
import { TopHeader, useUtcClock } from './top-header'

export type Notify = (message: string, tone?: 'ok' | 'crit') => void

export function AppShell() {
  const [active, setActive] = useState<ModuleId>('dashboard')
  const [toast, setToast] = useState<{ message: string; tone: 'ok' | 'crit' } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const contentRef = useRef<HTMLElement>(null)
  const now = useUtcClock()

  const notify = useCallback<Notify>((message, tone = 'ok') => {
    setToast({ message, tone })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(null), 2600)
  }, [])

  useEffect(() => () => clearTimeout(timer.current), [])

  const select = (id: ModuleId) => {
    setActive(id)
    contentRef.current?.scrollTo({ top: 0 })
  }

  const utc = now ? now.toISOString().slice(11, 19) : ''

  return (
    <div className="shell">
      <Sidebar active={active} onSelect={select} onEmergency={() => notify('Emergency channel to Flight Surgeon requested', 'crit')} />
      <div className="main-col">
        <TopHeader now={now} />
        <main ref={contentRef} className="content" aria-live="off">
          {active === 'dashboard' && <DashboardView notify={notify} utc={utc} onNavigate={select} />}
          {active === 'monitoring' && <MonitoringView notify={notify} />}
          {active === 'analytics' && <AnalyticsView onNavigate={select} />}
          {active === 'ai' && <AiAssessmentView notify={notify} />}
          {active === 'missions' && <MissionsView notify={notify} />}
          {active === 'profile' && <ProfileView notify={notify} />}
        </main>
      </div>
      {toast && (
        <div className={`toast ${toast.tone === 'crit' ? 'crit' : ''}`} role="status">
          {toast.tone === 'crit' ? <Siren size={16} aria-hidden="true" /> : <CircleCheck size={16} aria-hidden="true" />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  )
}
