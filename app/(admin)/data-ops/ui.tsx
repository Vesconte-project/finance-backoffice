'use client'

import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { isProxyDiagnostic, readApiError } from '@/lib/api-error'
import { requestClientJson } from '@/lib/client-json'

type JobStatus = 'queued' | 'running' | 'completed' | 'failed'
type DataOpsDomain = 'market' | 'fundamentals' | 'earnings' | 'macro' | 'release-calendar'
type RebuildMode = 'rebuild_missing_only' | 'rebuild_from_start_date' | 'wipe_rebuild'
type ScopeType = 'whole_domain' | 'region' | 'ticker' | 'date_range'

type DataOpsJob = {
  job_id: string
  status: JobStatus
  analysis_type: string
  ticker: string
  created_at?: string | null
  started_at?: string | null
  finished_at?: string | null
  error_message?: string | null
  worker_job_id?: string | null
  params?: Record<string, unknown> | null
  result?: Record<string, unknown> | null
}

type HealthCell = {
  count: number
  status: string
}

type HealthRow = {
  date: string
  domains: Record<string, HealthCell>
}

type HealthResponse = {
  start_date: string
  end_date: string
  rows: HealthRow[]
  summaries: Record<string, Record<string, unknown>>
}

type GapIssue = {
  domain: string
  startDate: string
  endDate: string
  missingDays: number
}

type BaseCheck = {
  status: 'ok' | 'partial' | 'unsupported' | 'warning' | 'unavailable' | 'stale' | 'missing' | string
  severity?: string
  unsupported?: string[]
  message?: string
}

type DuplicatesResponse = BaseCheck & {
  summary?: {
    duplicate_groups?: number
    duplicate_rows?: number
    severity?: string
  }
  groups?: Array<{
    domain?: string
    table?: string
    key?: string[]
    duplicate_count?: number
    sample_rows?: unknown[]
  }>
}

type FreshnessResponse = BaseCheck & {
  summary?: { ok?: number; warning?: number; stale?: number; unavailable?: number }
  items?: Array<{
    domain?: string
    identifier?: string
    identifier_type?: string
    latest_available_date?: string
    latest_updated_at?: string
    expected_latest_date?: string
    lag_days?: number
    severity?: string
    reason?: string
  }>
}

type SourceComparisonResponse = BaseCheck & {
  summary?: { match?: number; mismatch?: number; unavailable?: number }
  comparisons?: Array<{
    domain?: string
    identifier?: string
    left?: string
    right?: string
    status?: string
    differences?: Record<string, unknown>
    reason?: string
  }>
}

type MacroReleaseGapsResponse = BaseCheck & {
  summary?: {
    series_checked?: number
    missing_releases?: number
    severity?: string
  }
  items?: Array<{
    series_key?: string
    observation_period?: string
    expected_release_timestamp_utc?: string
    present?: boolean
    observed_first_available_at_utc?: string
    severity?: string
    reason?: string
  }>
}

const DOMAIN_OPTIONS: DataOpsDomain[] = ['market', 'fundamentals', 'earnings', 'macro', 'release-calendar']

function formatDate(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function statusClass(status: JobStatus): string {
  return `badge ${status}`
}

function healthClass(status?: string): string {
  if (status === 'ok') return 'cell-ok'
  if (status === 'missing') return 'cell-missing'
  return 'cell-na'
}

function statusColorClass(status?: string): string {
  const norm = String(status ?? '').trim().toLowerCase()
  if (norm === 'ok') return 'badge completed'
  if (norm === 'warning' || norm === 'partial') return 'badge running'
  if (norm === 'unsupported' || norm === 'unavailable') return 'badge queued'
  if (norm === 'missing' || norm === 'stale' || norm === 'error' || norm === 'failed') return 'badge failed'
  return 'badge'
}

function toTodayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function shiftIsoDays(days: number): string {
  const now = new Date()
  now.setDate(now.getDate() + days)
  return now.toISOString().slice(0, 10)
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function RequestErrorCard({ error }: { error: unknown }) {
  if (!error) return null
  if (isProxyDiagnostic(error)) {
    return (
      <div className="error">
        <strong>{String(error.error)}</strong>
        <div>{String(error.message)}</div>
        {typeof error.upstreamStatus === 'number' ? <div className="small">Upstream status: {error.upstreamStatus}</div> : null}
        {typeof error.upstreamContentType === 'string' ? <div className="small">Content-Type: {error.upstreamContentType}</div> : null}
        {typeof error.upstreamBodyPreview === 'string' && error.upstreamBodyPreview ? <pre>{error.upstreamBodyPreview}</pre> : null}
      </div>
    )
  }
  return <div className="error">{readApiError(error, 'Data quality request failed.')}</div>
}

function summarizeHealth(health: HealthResponse | null): Array<{ domain: string; coveredDays: number; missingDays: number; windowRows: number }> {
  if (!health) return []
  return Object.entries(health.summaries).map(([domain, summary]) => ({
    domain,
    coveredDays: Number(summary.covered_days ?? 0),
    missingDays: Number(summary.missing_days ?? 0),
    windowRows: Number(summary.window_rows ?? 0),
  }))
}

function deriveGapIssues(health: HealthResponse | null): GapIssue[] {
  if (!health) return []
  const issues: GapIssue[] = []

  for (const domain of Object.keys(health.summaries)) {
    let currentStart: string | null = null
    let currentEnd: string | null = null
    let missingDays = 0

    for (const row of health.rows) {
      const cell = row.domains[domain]
      if (cell?.status === 'missing') {
        currentStart ??= row.date
        currentEnd = row.date
        missingDays += 1
        continue
      }

      if (currentStart && currentEnd) {
        issues.push({ domain, startDate: currentStart, endDate: currentEnd, missingDays })
      }
      currentStart = null
      currentEnd = null
      missingDays = 0
    }

    if (currentStart && currentEnd) {
      issues.push({ domain, startDate: currentStart, endDate: currentEnd, missingDays })
    }
  }

  return issues.sort((a, b) => b.missingDays - a.missingDays)
}

export default function DataOpsConsole({ adminActor, initialDomain }: { adminActor: string; initialDomain?: string }) {
  const [jobs, setJobs] = useState<DataOpsJob[]>([])
  const [currentJob, setCurrentJob] = useState<DataOpsJob | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [duplicates, setDuplicates] = useState<DuplicatesResponse | null>(null)
  const [freshness, setFreshness] = useState<FreshnessResponse | null>(null)
  const [sourceComparison, setSourceComparison] = useState<SourceComparisonResponse | null>(null)
  const [macroGaps, setMacroGaps] = useState<MacroReleaseGapsResponse | null>(null)
  const [loadingHealth, setLoadingHealth] = useState(false)
  const [healthStartDate, setHealthStartDate] = useState(shiftIsoDays(-90))
  const [healthEndDate, setHealthEndDate] = useState(toTodayIso())
  const [healthTicker, setHealthTicker] = useState('')
  const [healthDomains, setHealthDomains] = useState<DataOpsDomain[]>(['market', 'macro', 'release-calendar'])

  const [domain, setDomain] = useState<DataOpsDomain>(normalizeDomain(initialDomain))
  const [mode, setMode] = useState<RebuildMode>('rebuild_missing_only')
  const [scopeType, setScopeType] = useState<ScopeType>('whole_domain')
  const [scopeRegion, setScopeRegion] = useState('us')
  const [scopeTicker, setScopeTicker] = useState('')
  const [scopeStartDate, setScopeStartDate] = useState(shiftIsoDays(-90))
  const [scopeEndDate, setScopeEndDate] = useState(toTodayIso())
  const [dryRun, setDryRun] = useState(true)
  const [confirmPhrase, setConfirmPhrase] = useState('')

  const [macroSeriesKey, setMacroSeriesKey] = useState('')
  const [macroSourceProvider, setMacroSourceProvider] = useState<'fred' | 'yfinance'>('fred')
  const [macroSourceCode, setMacroSourceCode] = useState('')
  const [macroFrequency, setMacroFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [macroBackfillStart, setMacroBackfillStart] = useState(shiftIsoDays(-365))
  const [macroBackfillEnd, setMacroBackfillEnd] = useState(toTodayIso())
  const [macroDryRun, setMacroDryRun] = useState(true)

  const [releaseSeriesKey, setReleaseSeriesKey] = useState('ICSA')
  const [releaseObservationPeriod, setReleaseObservationPeriod] = useState(toTodayIso())
  const [releaseObservationDate, setReleaseObservationDate] = useState(toTodayIso())
  const [releaseTimestampUtc, setReleaseTimestampUtc] = useState(`${toTodayIso()}T08:30:00Z`)
  const [releaseDryRun, setReleaseDryRun] = useState(true)

  const activeJobId = currentJob?.job_id ?? null

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const timer = setTimeout(() => {
      void loadJobs()
      void loadHealth()
    }, 0)
    return () => clearTimeout(timer)
  }, [])
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    if (!activeJobId) return
    if (!(currentJob?.status === 'queued' || currentJob?.status === 'running')) return
    const timer = setInterval(() => {
      void loadJob(activeJobId)
      void loadJobs()
    }, 4000)
    return () => clearInterval(timer)
  }, [activeJobId, currentJob?.status])

  async function loadJobs() {
    setLoadingJobs(true)
    setError(null)
    try {
      const payload = await requestClientJson('/api/data-ops/rebuild-jobs?limit=80')
      const record = payload as { jobs?: DataOpsJob[] }
      setJobs(Array.isArray(record.jobs) ? record.jobs : [])
    } catch (requestError) {
      setError(requestError)
    } finally {
      setLoadingJobs(false)
    }
  }

  async function loadJob(jobId: string) {
    try {
      const payload = await requestClientJson(`/api/data-ops/rebuild-jobs/${encodeURIComponent(jobId)}`)
      setCurrentJob(payload as DataOpsJob)
    } catch (requestError) {
      setError(requestError)
    }
  }

  async function loadHealth() {
    setLoadingHealth(true)
    setError(null)
    try {
      const query = new URLSearchParams()
      if (healthStartDate) query.set('start_date', healthStartDate)
      if (healthEndDate) query.set('end_date', healthEndDate)
      if (healthTicker.trim()) query.set('ticker', healthTicker.trim().toUpperCase())
      if (healthDomains.length > 0) query.set('domains', healthDomains.join(','))
      const payload = await requestClientJson(`/api/data-ops/health?${query.toString()}`)
      setHealth(payload as HealthResponse)

      const dQuery = new URLSearchParams()
      if (healthStartDate) dQuery.set('start_date', healthStartDate)
      if (healthEndDate) dQuery.set('end_date', healthEndDate)
      if (healthTicker.trim()) dQuery.set('ticker', healthTicker.trim().toUpperCase())
      const dom = healthDomains[0] || 'market'
      dQuery.set('domain', dom)

      const mQuery = new URLSearchParams()
      if (healthStartDate) mQuery.set('start_date', healthStartDate)
      if (healthEndDate) mQuery.set('end_date', healthEndDate)
      if (healthTicker.trim()) mQuery.set('series_key', healthTicker.trim().toUpperCase())

      await Promise.allSettled([
        requestClientJson(`/api/data-ops/duplicates?${dQuery.toString()}`).then(res => setDuplicates(res as DuplicatesResponse)),
        requestClientJson(`/api/data-ops/freshness?${dQuery.toString()}`).then(res => setFreshness(res as FreshnessResponse)),
        requestClientJson(`/api/data-ops/source-comparison?${dQuery.toString()}`).then(res => setSourceComparison(res as SourceComparisonResponse)),
        requestClientJson(`/api/data-ops/macro-release-gaps?${mQuery.toString()}`).then(res => setMacroGaps(res as MacroReleaseGapsResponse)),
      ])
    } catch (requestError) {
      setError(requestError)
    } finally {
      setLoadingHealth(false)
    }
  }

  async function submitRebuildJob() {
    setSubmitting(true)
    setError(null)
    try {
      const payload = await requestClientJson('/api/data-ops/rebuild-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain,
          mode,
          dry_run: dryRun,
          confirm_phrase: confirmPhrase || null,
          requested_scope_label: `${domain} / ${scopeType}`,
          scope: {
            scope_type: scopeType,
            region: scopeType === 'region' ? scopeRegion.trim().toLowerCase() : null,
            ticker: scopeType === 'ticker' ? scopeTicker.trim().toUpperCase() : null,
            start_date: scopeStartDate || null,
            end_date: scopeEndDate || null,
          },
        }),
      })
      setCurrentJob(payload as DataOpsJob)
      await loadJobs()
    } catch (requestError) {
      setError(requestError)
    } finally {
      setSubmitting(false)
    }
  }

  async function submitMacroSeriesJob() {
    setSubmitting(true)
    setError(null)
    try {
      const payload = await requestClientJson('/api/data-ops/series/macro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          series_key: macroSeriesKey.trim(),
          source_provider: macroSourceProvider,
          source_code: macroSourceCode.trim(),
          frequency: macroFrequency,
          dry_run: macroDryRun,
          backfill_start_date: macroBackfillStart || null,
          backfill_end_date: macroBackfillEnd || null,
        }),
      })
      setCurrentJob(payload as DataOpsJob)
      await loadJobs()
    } catch (requestError) {
      setError(requestError)
    } finally {
      setSubmitting(false)
    }
  }

  async function submitReleaseSeriesJob() {
    setSubmitting(true)
    setError(null)
    try {
      const payload = await requestClientJson('/api/data-ops/series/release-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          series_key: releaseSeriesKey.trim(),
          observation_period: releaseObservationPeriod.trim(),
          observation_date: releaseObservationDate.trim(),
          scheduled_release_timestamp_utc: releaseTimestampUtc.trim(),
          dry_run: releaseDryRun,
        }),
      })
      setCurrentJob(payload as DataOpsJob)
      await loadJobs()
    } catch (requestError) {
      setError(requestError)
    } finally {
      setSubmitting(false)
    }
  }

  async function retryJob(jobId: string) {
    setSubmitting(true)
    setError(null)
    try {
      const payload = await requestClientJson(`/api/data-ops/rebuild-jobs/${encodeURIComponent(jobId)}/retry`, {
        method: 'POST',
      })
      setCurrentJob(payload as DataOpsJob)
      await loadJobs()
    } catch (requestError) {
      setError(requestError)
    } finally {
      setSubmitting(false)
    }
  }

  const sortedJobs = useMemo(
    () => [...jobs].sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()),
    [jobs]
  )

  const healthSummary = useMemo(() => summarizeHealth(health), [health])
  const gapIssues = useMemo(() => deriveGapIssues(health), [health])
  const failedJobs = useMemo(() => sortedJobs.filter((job) => job.status === 'failed').slice(0, 5), [sortedJobs])
  const safeToResearch = useMemo(() => healthSummary.every((summary) => summary.missingDays === 0), [healthSummary])

  return (
    <div className="page-stack">
      <div className="card" id="rebuild">
        <div className="split-row">
          <div>
            <h2>Data Quality</h2>
            <p className="small">Issue discovery comes first: coverage gaps, stale domains, and failed repair jobs. Rebuild and refill actions stay available, but only after the operator can see what is broken.</p>
          </div>
          <div className="small">Admin: {adminActor}</div>
        </div>
      </div>

      <RequestErrorCard error={error} />

      <div className="metric-grid">
        <div className="card compact-card">
          <label>Research readiness</label>
          <div className="metric-value">{safeToResearch ? 'Go' : 'Caution'}</div>
          <div className="small">{safeToResearch ? 'No missing days detected in the current window.' : 'At least one domain has missing expected days.'}</div>
        </div>
        <div className="card compact-card">
          <label>Open gap ranges</label>
          <div className="metric-value">{gapIssues.length}</div>
          <div className="small">Derived from the current health snapshot.</div>
        </div>
        <div className="card compact-card">
          <label>Recent failed repair jobs</label>
          <div className="metric-value">{failedJobs.length}</div>
          <div className="small">Visible from the current rebuild-job history endpoint.</div>
        </div>
      </div>

      <div className="card">
        <div className="split-row">
          <div>
            <h3>Overview</h3>
            <p className="small">Current backend support: coverage windows, repair-job history, duplicates, freshness, macro-release validation, and source comparison.</p>
          </div>
          <div style={{ minWidth: 220 }}>
            <button className="secondary" type="button" onClick={() => void loadHealth()} disabled={loadingHealth}>
              {loadingHealth ? 'Refreshing...' : 'Refresh overview'}
            </button>
          </div>
        </div>

        <div className="row">
          <div>
            <label htmlFor="healthStart">Start date</label>
            <input id="healthStart" type="date" value={healthStartDate} onChange={(event) => setHealthStartDate(event.target.value)} />
          </div>
          <div>
            <label htmlFor="healthEnd">End date</label>
            <input id="healthEnd" type="date" value={healthEndDate} onChange={(event) => setHealthEndDate(event.target.value)} />
          </div>
          <div>
            <label htmlFor="healthTicker">Ticker focus</label>
            <input id="healthTicker" value={healthTicker} onChange={(event) => setHealthTicker(event.target.value)} placeholder="AAPL" />
          </div>
          <div>
            <label htmlFor="healthDomains">Domains</label>
            <select id="healthDomains" value={healthDomains.join(',')} onChange={(event) => setHealthDomains(event.target.value.split(',').map((item) => item.trim() as DataOpsDomain))}>
              <option value="market,macro,release-calendar">market + macro + release-calendar</option>
              <option value="market,fundamentals,earnings,macro,release-calendar">all domains</option>
              <option value="market">market</option>
              <option value="macro">macro</option>
              <option value="release-calendar">release-calendar</option>
            </select>
          </div>
        </div>

        <div className="table-wrap" style={{ marginTop: 14 }}>
          <table className="registry-table">
            <thead>
              <tr>
                <th>Domain</th>
                <th>Covered days</th>
                <th>Missing expected days</th>
                <th>Rows in window</th>
              </tr>
            </thead>
            <tbody>
              {healthSummary.map((summary) => (
                <tr key={summary.domain}>
                  <td>{summary.domain}</td>
                  <td>{summary.coveredDays}</td>
                  <td>{summary.missingDays}</td>
                  <td>{summary.windowRows}</td>
                </tr>
              ))}
              {!loadingHealth && healthSummary.length === 0 ? (
                <tr>
                  <td colSpan={4} className="small">No health snapshot loaded yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="feature-grid">
        <div className="card compact-card">
          <h3>Missing data</h3>
          {gapIssues.length === 0 ? <p className="small">No missing ranges detected in the current coverage window.</p> : null}
          {gapIssues.length > 0 ? <p className="small">{gapIssues.length} gap range(s) in the loaded window.</p> : null}
          <div className="list-stack diagnostic-scroll">
            {gapIssues.map((issue) => (
              <div className="list-row" key={`${issue.domain}-${issue.startDate}-${issue.endDate}`}>
                <div>
                  <strong>{issue.domain}</strong>
                  <div className="small">{issue.startDate} to {issue.endDate}</div>
                </div>
                <div>
                  <div>{issue.missingDays} missing business day(s)</div>
                  <div className="small">Suggested action: dry-run repair for this domain/date window.</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card compact-card">
          <h3>Duplicates</h3>
          {duplicates ? (
            <div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                <span className={statusColorClass(duplicates.status)}>{duplicates.status}</span>
                {duplicates.summary?.duplicate_groups !== undefined && <span className="small">{duplicates.summary.duplicate_groups} groups</span>}
                {duplicates.summary?.duplicate_rows !== undefined && <span className="small">{duplicates.summary.duplicate_rows} rows</span>}
              </div>
              {duplicates.message && <p className="small">{duplicates.message}</p>}
              {duplicates.unsupported && duplicates.unsupported.length > 0 && (
                <p className="small">Unsupported: {duplicates.unsupported.join(', ')}</p>
              )}
              {duplicates.groups && duplicates.groups.length > 0 ? (
                <div className="list-stack diagnostic-scroll">
                  {duplicates.groups.map((group, idx) => (
                    <div className="list-row" key={idx}>
                      <div>
                        <strong>{group.table || group.domain}</strong>
                        <div className="small">Keys: {(group.key || []).join(', ')}</div>
                      </div>
                      <div>
                        <div>{group.duplicate_count} duplicates</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
             <p className="small">Loading or not yet loaded.</p>
          )}
        </div>

        <div className="card compact-card">
          <h3>Freshness / staleness</h3>
          {freshness ? (
            <div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                <span className={statusColorClass(freshness.status)}>{freshness.status}</span>
                {freshness.summary && (
                  <span className="small">
                    {freshness.summary.stale || 0} stale, {freshness.summary.unavailable || 0} unavailable
                  </span>
                )}
              </div>
              {freshness.message && <p className="small">{freshness.message}</p>}
              {freshness.unsupported && freshness.unsupported.length > 0 && (
                <p className="small">Unsupported: {freshness.unsupported.join(', ')}</p>
              )}
              {freshness.items && freshness.items.length > 0 ? (
                <div className="list-stack diagnostic-scroll">
                  {freshness.items.map((item, idx) => (
                    <div className="list-row" key={idx}>
                      <div>
                        <strong>{item.identifier || item.domain}</strong>
                        {item.reason && <div className="small">{item.reason}</div>}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div>{item.lag_days !== undefined ? `${item.lag_days}d lag` : '—'}</div>
                        <div className="small">Latest: {item.latest_available_date || 'N/A'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="small">Loading or not yet loaded.</p>
          )}
        </div>

        <div className="card compact-card">
          <h3>Source comparison</h3>
          {sourceComparison ? (
            <div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                <span className={statusColorClass(sourceComparison.status)}>{sourceComparison.status}</span>
                {sourceComparison.summary && (
                  <span className="small">
                    {sourceComparison.summary.match || 0} match, {sourceComparison.summary.mismatch || 0} mismatch
                  </span>
                )}
              </div>
              {sourceComparison.message && <p className="small">{sourceComparison.message}</p>}
              {sourceComparison.unsupported && sourceComparison.unsupported.length > 0 && (
                <p className="small">Unsupported: {sourceComparison.unsupported.join(', ')}</p>
              )}
              {sourceComparison.comparisons && sourceComparison.comparisons.length > 0 ? (
                <div className="list-stack diagnostic-scroll">
                  {sourceComparison.comparisons.map((item, idx) => (
                    <div className="list-row" key={idx}>
                      <div>
                        <strong>Left: {item.left}</strong>
                        <div className="small">Right: {item.right}</div>
                      </div>
                      <div>
                        {item.reason ? <div className="small">{item.reason}</div> : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="small">Loading or not yet loaded.</p>
          )}
        </div>

        <div className="card compact-card">
          <h3>Macro release gaps</h3>
          {macroGaps ? (
            <div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                <span className={statusColorClass(macroGaps.status)}>{macroGaps.status}</span>
                {macroGaps.summary?.missing_releases !== undefined && <span className="small">{macroGaps.summary.missing_releases} missing</span>}
              </div>
              {macroGaps.message && <p className="small">{macroGaps.message}</p>}
              {macroGaps.unsupported && macroGaps.unsupported.length > 0 && (
                <p className="small">Unsupported: {macroGaps.unsupported.join(', ')}</p>
              )}
              {macroGaps.items && macroGaps.items.length > 0 ? (
                <div className="list-stack diagnostic-scroll">
                  {macroGaps.items.map((item, idx) => (
                    <div className="list-row" key={idx}>
                      <div>
                        <strong>{item.series_key}</strong>
                        <div className="small">Period: {item.observation_period}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div>{item.present ? 'Present' : 'Missing'}</div>
                        <div className="small">{item.reason}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="small">Loading or not yet loaded.</p>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Coverage matrix</h3>
        {health ? <p className="small">Window: {health.start_date} to {health.end_date}</p> : null}
        <div className="grid-health">
          <table className="health-table">
            <thead>
              <tr>
                <th>Date</th>
                {healthDomains.map((domainName) => (
                  <th key={domainName}>{domainName}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {health?.rows.map((row) => (
                <tr key={row.date}>
                  <td>{row.date}</td>
                  {healthDomains.map((domainName) => {
                    const cell = row.domains[domainName] || { count: 0, status: 'n/a' }
                    return (
                      <td key={`${row.date}-${domainName}`} className={healthClass(cell.status)}>
                        {cell.status} ({cell.count})
                      </td>
                    )
                  })}
                </tr>
              )) ?? null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="split-row">
          <div>
            <h3>Repair jobs</h3>
            <p className="small">Use dry-run repair first. The current backend supports rebuild jobs and manual macro/release upserts, but not issue-specific preview endpoints yet.</p>
          </div>
          <div style={{ minWidth: 220 }}>
            <button className="secondary" type="button" onClick={() => void loadJobs()} disabled={loadingJobs}>
              {loadingJobs ? 'Refreshing...' : 'Refresh jobs'}
            </button>
          </div>
        </div>

        <div className="row">
          <div>
            <label htmlFor="domain">Domain</label>
            <select id="domain" value={domain} onChange={(event) => setDomain(event.target.value as DataOpsDomain)}>
              {DOMAIN_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="mode">Mode</label>
            <select id="mode" value={mode} onChange={(event) => setMode(event.target.value as RebuildMode)}>
              <option value="rebuild_missing_only">rebuild_missing_only</option>
              <option value="rebuild_from_start_date">rebuild_from_start_date</option>
              <option value="wipe_rebuild">wipe_rebuild</option>
            </select>
          </div>
          <div>
            <label htmlFor="scopeType">Scope</label>
            <select id="scopeType" value={scopeType} onChange={(event) => setScopeType(event.target.value as ScopeType)}>
              <option value="whole_domain">whole_domain</option>
              <option value="region">region</option>
              <option value="ticker">ticker</option>
              <option value="date_range">date_range</option>
            </select>
          </div>
          <div>
            <label htmlFor="confirmPhrase">Confirm phrase (wipe)</label>
            <input id="confirmPhrase" value={confirmPhrase} onChange={(event) => setConfirmPhrase(event.target.value)} placeholder={`WIPE ${domain}`} />
          </div>
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          <div>
            <label htmlFor="scopeRegion">Region</label>
            <input id="scopeRegion" value={scopeRegion} onChange={(event) => setScopeRegion(event.target.value)} />
          </div>
          <div>
            <label htmlFor="scopeTicker">Ticker</label>
            <input id="scopeTicker" value={scopeTicker} onChange={(event) => setScopeTicker(event.target.value)} />
          </div>
          <div>
            <label htmlFor="scopeStart">Start date</label>
            <input id="scopeStart" type="date" value={scopeStartDate} onChange={(event) => setScopeStartDate(event.target.value)} />
          </div>
          <div>
            <label htmlFor="scopeEnd">End date</label>
            <input id="scopeEnd" type="date" value={scopeEndDate} onChange={(event) => setScopeEndDate(event.target.value)} />
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
          <label style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={dryRun} onChange={(event) => setDryRun(event.target.checked)} style={{ width: 'auto' }} />
            dry run
          </label>
          <button className="primary" type="button" onClick={() => void submitRebuildJob()} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Queue repair'}
          </button>
        </div>

        <details style={{ marginTop: 14 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Advanced repair inputs</summary>
          <div className="advanced-panel">
            <div className="row">
              <div>
                <label htmlFor="macroSeriesKey">Macro series key</label>
                <input id="macroSeriesKey" value={macroSeriesKey} onChange={(event) => setMacroSeriesKey(event.target.value)} />
              </div>
              <div>
                <label htmlFor="macroSourceProvider">Source provider</label>
                <select id="macroSourceProvider" value={macroSourceProvider} onChange={(event) => setMacroSourceProvider(event.target.value as 'fred' | 'yfinance')}>
                  <option value="fred">fred</option>
                  <option value="yfinance">yfinance</option>
                </select>
              </div>
              <div>
                <label htmlFor="macroSourceCode">Source code</label>
                <input id="macroSourceCode" value={macroSourceCode} onChange={(event) => setMacroSourceCode(event.target.value)} />
              </div>
              <div>
                <label htmlFor="macroFrequency">Frequency</label>
                <select id="macroFrequency" value={macroFrequency} onChange={(event) => setMacroFrequency(event.target.value as 'daily' | 'weekly' | 'monthly')}>
                  <option value="daily">daily</option>
                  <option value="weekly">weekly</option>
                  <option value="monthly">monthly</option>
                </select>
              </div>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <div>
                <label htmlFor="macroBackfillStart">Macro backfill start</label>
                <input id="macroBackfillStart" type="date" value={macroBackfillStart} onChange={(event) => setMacroBackfillStart(event.target.value)} />
              </div>
              <div>
                <label htmlFor="macroBackfillEnd">Macro backfill end</label>
                <input id="macroBackfillEnd" type="date" value={macroBackfillEnd} onChange={(event) => setMacroBackfillEnd(event.target.value)} />
              </div>
              <div className="checkbox-row">
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={macroDryRun} onChange={(event) => setMacroDryRun(event.target.checked)} style={{ width: 'auto' }} />
                  dry run
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'end' }}>
                <button className="secondary" type="button" onClick={() => void submitMacroSeriesJob()} disabled={submitting}>Queue macro upsert</button>
              </div>
            </div>

            <div className="row" style={{ marginTop: 14 }}>
              <div>
                <label htmlFor="releaseSeriesKey">Release series key</label>
                <input id="releaseSeriesKey" value={releaseSeriesKey} onChange={(event) => setReleaseSeriesKey(event.target.value)} />
              </div>
              <div>
                <label htmlFor="releaseObservationPeriod">Observation period</label>
                <input id="releaseObservationPeriod" value={releaseObservationPeriod} onChange={(event) => setReleaseObservationPeriod(event.target.value)} />
              </div>
              <div>
                <label htmlFor="releaseObservationDate">Observation date</label>
                <input id="releaseObservationDate" value={releaseObservationDate} onChange={(event) => setReleaseObservationDate(event.target.value)} />
              </div>
              <div>
                <label htmlFor="releaseTimestampUtc">Scheduled release timestamp UTC</label>
                <input id="releaseTimestampUtc" value={releaseTimestampUtc} onChange={(event) => setReleaseTimestampUtc(event.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
              <label style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={releaseDryRun} onChange={(event) => setReleaseDryRun(event.target.checked)} style={{ width: 'auto' }} />
                dry run
              </label>
              <button className="secondary" type="button" onClick={() => void submitReleaseSeriesJob()} disabled={submitting}>Queue release upsert</button>
            </div>
          </div>
        </details>

        <div className="table-wrap" style={{ marginTop: 14 }}>
          <table className="registry-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Status</th>
                <th>Domain</th>
                <th>Created</th>
                <th>Finished</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedJobs.map((job) => (
                <tr key={job.job_id}>
                  <td>
                    <strong>{job.job_id}</strong>
                    <div className="small">{job.analysis_type}</div>
                  </td>
                  <td><span className={statusClass(job.status)}>{job.status}</span></td>
                  <td>{job.ticker}</td>
                  <td>{formatDate(job.created_at)}</td>
                  <td>{formatDate(job.finished_at)}</td>
                  <td>
                    <div className="table-actions">
                      <button className="secondary" type="button" onClick={() => void loadJob(job.job_id)}>Open</button>
                      {job.status === 'failed' ? (
                        <button className="secondary" type="button" onClick={() => void retryJob(job.job_id)} disabled={submitting}>Retry</button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!loadingJobs && sortedJobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="small">No repair jobs found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {currentJob ? (
        <div className="card">
          <h3>Repair job detail</h3>
          <div className="field-grid">
            <Field label="job_id" value={currentJob.job_id} />
            <Field label="status" value={<span className={statusClass(currentJob.status)}>{currentJob.status}</span>} />
            <Field label="analysis_type" value={currentJob.analysis_type} />
            <Field label="worker_job_id" value={currentJob.worker_job_id} />
            <Field label="created_at" value={formatDate(currentJob.created_at)} />
            <Field label="finished_at" value={formatDate(currentJob.finished_at)} />
          </div>
          {currentJob.error_message ? <div className="error">{currentJob.error_message}</div> : null}
          <pre>{JSON.stringify(currentJob.result ?? currentJob.params ?? {}, null, 2)}</pre>
        </div>
      ) : null}

      <div className="card">
        <h3>Missing backend contracts</h3>
        <ul className="plain-list">
          <li>`GET /analyst/data-ops/issues/{'{domain}'}`: issue-specific detail endpoint so repair actions can open directly from a detected problem.</li>
        </ul>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <label>{label}</label>
      <div className="field-value">{value}</div>
    </div>
  )
}

function normalizeDomain(value?: string): DataOpsDomain {
  return DOMAIN_OPTIONS.includes(value as DataOpsDomain) ? value as DataOpsDomain : 'market'
}
