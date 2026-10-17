'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { requestClientJson } from '@/lib/client-json'

export type SidebarDot = 'green' | 'amber' | 'red' | 'gray'

export type SidebarHealth = {
  data: SidebarDot
  research: SidebarDot
  evaluation: SidebarDot
  production: SidebarDot
  frontoffice: SidebarDot
  system: SidebarDot
}

type NavItem = {
  label: string
  href: string
  dot?: SidebarDot
  badge?: string | number
}

type NavSection = {
  label: string
  items: NavItem[]
}

type Props = {
  health: SidebarHealth
  candidateCount?: number
  loadStatus?: boolean
}

function Dot({ color }: { color: SidebarDot }) {
  return (
    <span className={`sidebar-dot ${color}`} />
  )
}

export function Sidebar({ health, candidateCount, loadStatus = false }: Props) {
  const pathname = usePathname()
  const [sidebarHealth, setSidebarHealth] = useState(health)
  const [sidebarCandidateCount, setSidebarCandidateCount] = useState(candidateCount)
  const isActive = (href: string) => {
    const cleanHref = href.split('#')[0]
    return cleanHref === '/' ? pathname === '/' : pathname.startsWith(cleanHref)
  }

  useEffect(() => {
    if (!loadStatus) return
    let cancelled = false

    async function loadSidebarStatus() {
      try {
        const payload = await requestClientJson('/api/sidebar-state')
        if (cancelled || !isSidebarState(payload)) return
        setSidebarHealth(payload.health)
        setSidebarCandidateCount(payload.candidateCount)
      } catch {
        // Sidebar health is non-critical; keep the initial gray state on failure.
      }
    }

    void loadSidebarStatus()
    return () => {
      cancelled = true
    }
  }, [loadStatus])

  const sections: NavSection[] = [
    {
      label: '',
      items: [
        { label: 'Overview', href: '/', dot: sidebarHealth.system },
      ],
    },
    {
      label: 'DATA',
      items: [
        { label: 'Data Control', href: '/data-control', dot: sidebarHealth.data },
        { label: 'Data Ops', href: '/data-ops', dot: 'gray' },
        { label: 'Entity Layer', href: '/entity-layer', dot: 'gray' },
      ],
    },
    {
      label: 'RELATIONSHIP MAP',
      items: [
        { label: 'Source health', href: '/relationship-map', dot: 'gray' },
      ],
    },
    {
      label: 'RESEARCH',
      items: [
        { label: 'Exceptional access', href: '/research', dot: sidebarHealth.research },
      ],
    },
    {
      label: 'EVALUATION',
      items: [
        { label: 'Evaluation', href: '/production', dot: sidebarHealth.evaluation, badge: sidebarCandidateCount },
      ],
    },
    {
      label: 'PRODUCTION',
      items: [
        { label: 'Production', href: '/production', dot: sidebarHealth.production },
        { label: 'Daily inference', href: '/production/daily-inference', dot: sidebarHealth.production },
      ],
    },
    {
      label: 'FRONTOFFICE',
      items: [
        { label: 'AI research', href: '/frontoffice', dot: sidebarHealth.frontoffice },
        { label: 'User models', href: '/frontoffice#user-models', dot: 'gray' },
      ],
    },
    {
      label: 'SYSTEM',
      items: [
        {
          label: 'Operations',
          href: '/operations',
          dot: sidebarHealth.system,
        },
        { label: 'Contracts', href: '/contracts', dot: 'gray' },
        { label: 'System', href: '/diagnostics', dot: sidebarHealth.system },
      ],
    },
  ]

  return (
    <aside className="sidebar-shell">
      <div className="sidebar-brand">
        <div className="sidebar-title">spy-signal</div>
        <div className="sidebar-env">PROD</div>
      </div>
      <nav className="sidebar-nav" aria-label="Backoffice navigation">
        {sections.map((section, index) => (
          <div className="sidebar-section" key={section.label || `section-${index}`}>
            {section.label ? <div className="sidebar-section-label">{section.label}</div> : null}
            {section.items.map((item) => (
              <Link
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={isActive(item.href) ? 'sidebar-link active' : 'sidebar-link'}
                href={item.href}
                key={item.href}
              >
                {item.dot ? <Dot color={item.dot} /> : null}
                <span className="sidebar-link-label">{item.label}</span>
                {item.badge !== undefined ? <span className="sidebar-badge">{item.badge}</span> : null}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">admin</div>
    </aside>
  )
}

function isSidebarState(payload: unknown): payload is {
  health: SidebarHealth
  candidateCount?: number
} {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  const record = payload as Record<string, unknown>
  return Boolean(record.health && typeof record.health === 'object' && !Array.isArray(record.health))
}
