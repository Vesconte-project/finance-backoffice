import Link from 'next/link'
import type { ReactNode } from 'react'
import { requireAdminUser } from '@/lib/admin-auth'
import { requestBackendJson } from '@/lib/backend-client'
import { timeAgo, truncateId } from '@/lib/format'

type BackendRequestOptions = Parameters<typeof requestBackendJson>[0]
type TimedFetch = { payload: unknown; upstream: Response } | null
type SettledFetch = PromiseSettledResult<TimedFetch>

type Action = {
  text: string
  href: string
  sub?: string
}

type FeedItem = {
  text: string
  href?: string
  at?: string | null
  tone: 'green' | 'amber' | 'red' | 'blue'
}

const DEFAULT_CONTROL_ROOM_TIMEOUT_MS = 2500
const DATA_HEALTH_TIMEOUT_MS = 2500

export default async function HomePage() {
  await requireAdminUser()
  const today = new Date().toISOString().slice(0, 10)
  const thirtyDaysAgo = shiftIsoDays(-30)
  const [health, dataHealth, experiments, candidates, signalHistory, jobs, rebuildJobs, activePointers] = await Promise.allSettled([
    fetchWithTimeout({ path: '/health', includeCloudflareAccess: true }, 'backend health'),
    fetchWithTimeout({
      path: '/analyst/data-ops/health',
      searchParams: new URLSearchParams({ domains: 'market,macro,release-calendar', start_date: thirtyDaysAgo, end_date: today }),
      requireBackendServiceToken: true,
      includeCloudflareAccess: true,
    }, 'data health', DATA_HEALTH_TIMEOUT_MS),
    fetchWithTimeout({
      path: '/analyst/research/experiments',
      searchParams: new URLSearchParams({ limit: '80' }),
      requireBackendServiceToken: true,
      includeCloudflareAccess: true,
    }, 'research experiments'),
    fetchWithTimeout({
      path: '/analyst/signal-evaluation/candidates',
      searchParams: new URLSearchParams({ limit: '200', include_official: 'true' }),
      requireBackendServiceToken: true,
      includeCloudflareAccess: true,
    }, 'signal candidates'),
    fetchWithTimeout({
      path: '/signals/history/SPY',
      searchParams: new URLSearchParams({ limit: '20' }),
      includeCloudflareAccess: true,
    }, 'signal history'),
    fetchWithTimeout({
      path: '/analyst/jobs',
      searchParams: new URLSearchParams({ limit: '80' }),
      includeCloudflareAccess: true,
    }, 'analyst jobs'),
    fetchWithTimeout({
      path: '/analyst/data-ops/rebuild-jobs',
      searchParams: new URLSearchParams({ limit: '40' }),
      includeCloudflareAccess: true,
    }, 'data rebuild jobs'),
    fetchWithTimeout({
      path: '/analyst/registry/active-pointers',
      searchParams: new URLSearchParams({ limit: '20' }),
      requireBackendServiceToken: true,
      includeCloudflareAccess: true,
    }, 'active pointers'),
  ])

  const dataPayload = payloadOf(dataHealth)
  const experimentPayload = payloadOf(experiments)
  const candidatePayload = payloadOf(candidates)
  const healthPayload = payloadOf(health)
  const experimentRows = itemsOf(payloadOf(experiments), ['experiments', 'items', 'results'])
  const candidateRows = itemsOf(payloadOf(candidates), ['candidates', 'items', 'results'])
  const signalRows = itemsOf(payloadOf(signalHistory), ['history', 'signals', 'items', 'results'])
  const jobRows = itemsOf(payloadOf(jobs), ['jobs', 'items', 'results'])
  const rebuildRows = itemsOf(payloadOf(rebuildJobs), ['jobs', 'items', 'results'])
  const pointerRows = itemsOf(payloadOf(activePointers), ['active_pointers', 'pointers', 'items', 'results'])

  const coverage = dataCoverage(dataPayload)
  const staleSources = staleSourceRows(dataPayload)
  const runningExperiments = experimentRows.filter((row) => ['running', 'queued', 'started'].includes(readLower(row, ['status', 'state']))).length
  const failedExperiments = experimentRows.filter((row) => readLower(row, ['status', 'state']) === 'failed').length
  const promoReady = candidateRows.filter(isPromoReady).length
  const failedJobs = [...jobRows, ...rebuildRows].filter((row) => readLower(row, ['status', 'state']) === 'failed')
  const latestSignal = signalRows[0] ?? {}
  const activePointer = pointerRows[0] ?? {}
  const lastFlip = signalRows.find((row) => readSignalDirection(row))
  const officialDirection = readSignalDirection(lastFlip) || 'neutral'
  const officialTicker = readText(lastFlip, ['ticker', 'symbol']) || readText(activePointer, ['ticker', 'symbol']) || 'SPY'
  const officialTimestamp = readText(lastFlip, ['signal_date', 'date', 'updated_at'])
  const officialLabel = readText(activePointer, ['signal_name', 'name', 'label']) || readText(latestSignal, ['signal_name', 'name', 'label'])
  const actions = buildActions(staleSources, experimentRows, failedJobs, candidateRows)
  const feed = buildFeed(experimentRows, jobRows, signalRows, rebuildRows)

  return (
    <div className="page-stack">
      <div className="control-kpi-grid">
        <KpiTile href="/data" label="Data coverage" value={coverage === null ? '—' : String(coverage)} unit={coverage === null ? undefined : '%'} sub={dataPayload ? `${staleSources.length} sources stale` : 'unavailable'} tone={staleSources.length ? 'amber' : undefined} />
        <KpiTile href="/research" label="Research" value={experimentPayload ? String(runningExperiments) : '—'} sub={experimentPayload ? `${failedExperiments} failed` : 'unavailable'} tone={failedExperiments ? 'red' : undefined} />
        <KpiTile href="/evaluation" label="Candidates" value={candidatePayload ? String(candidateRows.length) : '—'} sub={candidatePayload ? `${promoReady} promo-ready` : 'unavailable'} tone={promoReady ? 'green' : undefined} />
        <KpiTile
          href="/production"
          label="Live model"
          value={formatOfficialSignalValue({ label: officialLabel, ticker: officialTicker, direction: officialDirection })}
          sub={lastFlip ? <OfficialSignalSub direction={officialDirection} timestamp={officialTimestamp} /> : 'unavailable'}
        />
      </div>

      <div className="control-room-grid">
        <section className="card">
          <div className="split-row">
            <h2>Next actions</h2>
            <span className={healthPayload ? 'badge completed' : 'badge queued'}>
              {healthPayload ? 'backend healthy' : 'health unavailable'}
            </span>
          </div>
          {actions.length ? (
            <ol className="action-list">
              {actions.slice(0, 5).map((action) => (
                <li key={`${action.href}-${action.text}`}>
                  <Link href={action.href}>{action.text}</Link>
                  {action.sub ? <div className="small">{action.sub}</div> : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="small">No open actions - system looks healthy.</p>
          )}
        </section>

        <section className="card">
          <div className="split-row">
            <h2>Live feed</h2>
          </div>
          {feed.length ? (
            <div className="feed-list">
              {feed.slice(0, 12).map((item, index) => (
                <FeedRow item={item} key={`${item.text}-${item.at ?? index}`} />
              ))}
            </div>
          ) : (
            <p className="small">No recent activity - check backend health.</p>
          )}
        </section>
      </div>
    </div>
  )
}

function KpiTile({
  href,
  label,
  value,
  unit,
  sub,
  tone,
}: {
  href: string
  label: string
  value: string
  unit?: string
  sub: ReactNode
  tone?: 'green' | 'amber' | 'red'
}) {
  return (
    <Link className="control-kpi-card" href={href}>
      <label>{label}</label>
      <div className="metric-value">{value}{unit ? <span className="metric-unit">{unit}</span> : null}</div>
      <div className={tone ? `small text-${tone}` : 'small'}>{sub}</div>
    </Link>
  )
}

function OfficialSignalSub({ direction, timestamp }: { direction: string; timestamp: string }) {
  const label = direction && direction !== '—' ? direction : 'neutral'
  const neutral = label.trim().toLowerCase() === 'neutral'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      <span
        className={`badge ${directionBadgeClass(label)}`}
        style={neutral ? { fontSize: 10, padding: '2px 6px', background: '#e5e7eb', color: '#4b5563' } : { fontSize: 10, padding: '2px 6px' }}
      >
        {label}
      </span>
      <span>{timestamp ? timeAgo(timestamp) : '—'}</span>
    </span>
  )
}

function FeedRow({ item }: { item: FeedItem }) {
  const content = (
    <>
      <span className={`feed-dot ${item.tone}`} />
      <span>
        {item.text}
        <span className="feed-time">{item.at ? timeAgo(item.at) : '—'}</span>
      </span>
    </>
  )
  return item.href ? <Link className="feed-row" href={item.href}>{content}</Link> : <div className="feed-row">{content}</div>
}

function buildActions(
  staleSources: SourceGap[],
  experiments: Record<string, unknown>[],
  failedJobs: Record<string, unknown>[],
  candidates: Record<string, unknown>[]
): Action[] {
  const actions: Action[] = []
  const stale = staleSources[0]
  if (stale) {
    actions.push({
      text: `${stale.source} missing ${stale.missingDays}d of data`,
      href: `/data?source=${encodeURIComponent(stale.source)}#rebuild`,
      sub: `Source: ${stale.source}`,
    })
  }

  const completedWithNoCandidate = experiments.find((row) => readLower(row, ['status', 'state']) === 'completed' && !readText(row, ['candidate_id', 'candidateId']))
  if (completedWithNoCandidate) {
    const id = readText(completedWithNoCandidate, ['experiment_id', 'id']) || 'experiment'
    actions.push({
      text: `${truncateId(id, 14)} completed with no candidate output`,
      href: '/research',
      sub: `Run finished ${timeAgo(readText(completedWithNoCandidate, ['completed_at', 'finished_at', 'updated_at']))}`,
    })
  }

  const failedJob = failedJobs[0]
  if (failedJob) {
    actions.push({
      text: `${readText(failedJob, ['name', 'analysis_type', 'job_id', 'id']) || 'Job'} failed`,
      href: '/analyst',
      sub: timeAgo(readText(failedJob, ['failed_at', 'finished_at', 'updated_at', 'created_at'])),
    })
  }

  const partialCandidate = candidates.find((row) => hasEvidence(row, ['equity', 'equity_curve']) && hasEvidence(row, ['drawdown']) && !hasEvidence(row, ['ic', 'ic_mean', 'ic_latest']))
  if (partialCandidate) {
    const id = readText(partialCandidate, ['candidate_id', 'id']) || 'candidate'
    actions.push({
      text: `${truncateId(id, 14)} is promo-ready but IC evidence missing`,
      href: '/evaluation',
      sub: 'All other gates pass',
    })
  }

  return actions
}

function buildFeed(
  experiments: Record<string, unknown>[],
  jobs: Record<string, unknown>[],
  signalHistory: Record<string, unknown>[],
  rebuildJobs: Record<string, unknown>[]
): FeedItem[] {
  const items: FeedItem[] = [
    ...experiments.map((row) => ({
      text: `Experiment ${truncateId(readText(row, ['experiment_id', 'id']) || 'unknown', 12)} ${readText(row, ['status', 'state']) || 'updated'}`,
      href: '/research',
      at: readText(row, ['updated_at', 'completed_at', 'created_at']),
      tone: toneForStatus(readLower(row, ['status', 'state'])),
    })),
    ...jobs.map((row) => ({
      text: `Analyst job ${truncateId(readText(row, ['job_id', 'id']) || 'unknown', 12)} ${readText(row, ['status', 'state']) || 'updated'}`,
      href: '/analyst',
      at: readText(row, ['updated_at', 'finished_at', 'created_at']),
      tone: toneForStatus(readLower(row, ['status', 'state'])),
    })),
    ...rebuildJobs.map((row) => ({
      text: `Data rebuild ${truncateId(readText(row, ['job_id', 'id']) || 'unknown', 12)} ${readText(row, ['status', 'state']) || 'updated'}`,
      href: '/data#rebuild',
      at: readText(row, ['updated_at', 'finished_at', 'created_at']),
      tone: toneForStatus(readLower(row, ['status', 'state'])),
    })),
    ...signalHistory.map((row) => ({
      text: `Signal ${readText(row, ['ticker', 'symbol']) || 'SPY'} ${readText(row, ['direction', 'signal', 'stance']) || 'updated'}`,
      href: '/evaluation',
      at: readText(row, ['signal_date', 'date', 'updated_at']),
      tone: 'blue' as const,
    })),
  ]

  return items
    .filter((item) => item.text.trim())
    .sort((a, b) => new Date(b.at ?? 0).getTime() - new Date(a.at ?? 0).getTime())
}

type SourceGap = {
  source: string
  missingDays: number
}

function staleSourceRows(payload: unknown): SourceGap[] {
  const summaries = isRecord(payload) && isRecord(payload.summaries) ? payload.summaries : {}
  return Object.entries(summaries).map(([source, summary]) => ({
    source,
    missingDays: Number(isRecord(summary) ? summary.missing_days ?? 0 : 0),
  })).filter((row) => row.missingDays > 0).sort((a, b) => b.missingDays - a.missingDays)
}

function dataCoverage(payload: unknown): number | null {
  const rows = itemsOf(payload, ['rows'])
  const statuses = rows.flatMap((row) => Object.values(isRecord(row.domains) ? row.domains : {}).map((cell) => readLower(cell, ['status'])))
  if (!statuses.length) return null
  const ok = statuses.filter((status) => status === 'ok').length
  return Math.round((ok / statuses.length) * 100)
}

function isPromoReady(row: Record<string, unknown>): boolean {
  const status = readLower(row, ['status', 'overall_status', 'readiness_status'])
  return ['promo_ready', 'promotion_ready', 'approved', 'ready'].includes(status)
}

function hasEvidence(row: Record<string, unknown>, keys: string[]): boolean {
  const metrics = isRecord(row.metrics) ? row.metrics : {}
  const flat = { ...row, ...metrics }
  return keys.some((key) => flat[key] !== null && flat[key] !== undefined && flat[key] !== '')
}

async function fetchWithTimeout(options: BackendRequestOptions, label: string, timeoutMs = DEFAULT_CONTROL_ROOM_TIMEOUT_MS): Promise<TimedFetch> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const startedAt = Date.now()
  try {
    const result = await Promise.race([
      requestBackendJson(options),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs)
      }),
    ])
    if (timer) clearTimeout(timer)
    const elapsedMs = Date.now() - startedAt
    if (result === null) {
      console.warn(`[control-room] ${label} timed out after ${elapsedMs}ms`)
      return null
    }
    console.info(`[control-room] ${label} completed in ${elapsedMs}ms`)
    return result
  } catch (error) {
    if (timer) clearTimeout(timer)
    console.warn(`[control-room] ${label} failed after ${Date.now() - startedAt}ms`, error instanceof Error ? error.message : error)
    return null
  }
}

function payloadOf(result: SettledFetch): unknown {
  return result.status === 'fulfilled' && result.value?.upstream.ok ? result.value.payload : null
}

function itemsOf(payload: unknown, keys: string[]): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter(isRecord)
  if (!isRecord(payload)) return []
  for (const key of keys) {
    const value = payload[key]
    if (Array.isArray(value)) return value.filter(isRecord)
  }
  return []
}

function readText(row: unknown, keys: string[]): string {
  if (!isRecord(row)) return ''
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) return value
    if (typeof value === 'number') return String(value)
  }
  return ''
}

function readLower(row: unknown, keys: string[]): string {
  return readText(row, keys).trim().toLowerCase()
}

function readSignalDirection(row: unknown): string {
  const direction = readLower(row, ['direction', 'stance'])
  if (['long', 'short', 'neutral', 'buy', 'sell', 'flat', 'hold'].includes(direction)) {
    return direction
  }

  const signal = readLower(row, ['signal'])
  if (['long', 'short', 'neutral', 'buy', 'sell', 'flat', 'hold'].includes(signal)) {
    return signal
  }

  return ''
}

function toneForStatus(status: string): FeedItem['tone'] {
  if (status === 'failed' || status === 'error') return 'red'
  if (status === 'queued' || status === 'running' || status === 'started') return 'amber'
  if (status === 'completed' || status === 'ok' || status === 'succeeded') return 'green'
  return 'blue'
}

function directionBadgeClass(direction: string): string {
  const normalized = direction.trim().toLowerCase()
  if (normalized === 'long' || normalized === 'buy') return 'completed'
  if (normalized === 'short' || normalized === 'sell') return 'failed'
  return 'queued'
}

function formatOfficialSignalValue({
  label,
  ticker,
  direction,
}: {
  label: string
  ticker: string
  direction: string
}): string {
  if (label && !/^\d+$/.test(label)) return truncateId(label, 18)
  return `${ticker || 'SPY'} · ${direction || 'neutral'}`
}

function shiftIsoDays(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
