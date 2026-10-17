import { type SidebarHealth } from '@/components/layout/Sidebar'
import { requestBackendJson } from '@/lib/backend-client'

const SIDEBAR_REQUEST_TIMEOUT_MS = 2500

type SidebarState = {
  health: SidebarHealth
  candidateCount?: number
  failedJobCount?: number
}

type TimedFetch = { payload: unknown; upstream: Response } | null

export async function loadSidebarState(): Promise<SidebarState> {
  const today = new Date().toISOString().slice(0, 10)
  const [system, data, production] = await Promise.allSettled([
    requestBackendJsonWithTimeout({ path: '/me' }),
    requestBackendJsonWithTimeout({ path: '/analyst/data-ops/health',
      searchParams: new URLSearchParams({ domains: 'market,macro,release-calendar', end_date: today }) }),
    requestBackendJsonWithTimeout({ path: '/analyst/registry/active-pointers',
      searchParams: new URLSearchParams({ environment: 'production' }) }),
  ])
  return { health: { ...grayHealth(),
    data: dotForDataHealth(settledPayload(data)),
    production: production.status === 'fulfilled' && production.value?.upstream.ok ? 'green' : 'gray',
    system: system.status === 'fulfilled' && system.value?.upstream.ok ? 'green' : 'gray',
  } }
}


export function grayHealth(): SidebarHealth {
  return {
    data: 'gray',
    research: 'gray',
    evaluation: 'gray',
    production: 'gray',
    frontoffice: 'gray',
    system: 'gray',
  }
}

async function requestBackendJsonWithTimeout(options: Parameters<typeof requestBackendJson>[0]): Promise<TimedFetch> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      requestBackendJson(options),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), SIDEBAR_REQUEST_TIMEOUT_MS)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function settledPayload(result: PromiseSettledResult<TimedFetch>): unknown {
  return result.status === 'fulfilled' && result.value?.upstream.ok ? result.value.payload : null
}

function dotForDataHealth(payload: unknown): SidebarHealth['data'] {
  const rows = readItems(payload, ['rows'])
  if (!payload) return 'gray'
  if (rows.some((row) => Object.values(readRecord(row, 'domains')).some((cell) => readString(cell, ['status']) === 'missing'))) return 'red'
  if (rows.some((row) => Object.values(readRecord(row, 'domains')).some((cell) => readString(cell, ['status']) !== 'ok'))) return 'amber'
  return 'green'
}

function readItems(payload: unknown, keys: string[]): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter(isRecord)
  if (!isRecord(payload)) return []
  for (const key of keys) {
    const value = payload[key]
    if (Array.isArray(value)) return value.filter(isRecord)
  }
  return []
}

function readRecord(payload: unknown, key: string): Record<string, unknown> {
  if (!isRecord(payload)) return {}
  const value = payload[key]
  return isRecord(value) ? value : {}
}

function readString(payload: unknown, keys: string[]): string {
  if (!isRecord(payload)) return ''
  for (const key of keys) {
    const value = payload[key]
    if (typeof value === 'string') return value.toLowerCase()
  }
  return ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
