'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { requestClientJson } from '@/lib/client-json'
import { asRecord, firstList, type RowRecord } from '@/lib/payload'

type Props = { adminActor: string }
type EarningsMode = 'pit' | 'latest'

type EarningsRow = {
  eventId: string
  fiscalPeriod: string
  reportDate: string | null
  reportTime: string | null
  timezone: string | null
  eventStatus: string
  isConfirmed: boolean | null
  epsActual: number | null
  epsEstimate: number | null
  epsSurprise: number | null
  revenueActual: number | null
  revenueEstimate: number | null
  knownAt: string | null
  source: string | null
  primarySource: string | null
  sourceMetadata: unknown
  dataQualityFlags: unknown
}

type EarningsResponse = {
  available: boolean | null
  reason: string | null
  symbol: string | null
  count: number
  mode: string | null
  isPointInTime: boolean | null
  rows: EarningsRow[]
}

export function EarningsEventsWorkspace({ adminActor }: Props) {
  const [symbol, setSymbol] = useState('AAPL')
  const [eventStatus, setEventStatus] = useState('')
  const [fiscalPeriod, setFiscalPeriod] = useState('')
  const [mode, setMode] = useState<EarningsMode>('pit')
  const [latestOnly, setLatestOnly] = useState(false)
  const [payload, setPayload] = useState<unknown | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const response = useMemo(() => normalizeResponse(payload), [payload])

  async function loadEvents(
    nextSymbol = symbol,
    nextStatus = eventStatus,
    nextPeriod = fiscalPeriod,
    nextMode = mode,
    nextLatestOnly = latestOnly,
  ) {
    const normalizedSymbol = nextSymbol.trim().toUpperCase()
    if (!normalizedSymbol) {
      setPayload(null)
      setError('Enter a symbol.')
      return
    }
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ symbol: normalizedSymbol, limit: '250' })
    if (nextMode === 'pit') params.set('latestOnly', String(nextLatestOnly))
    if (nextStatus) params.set('eventStatus', nextStatus)
    if (nextPeriod.trim()) params.set('fiscalPeriod', nextPeriod.trim())
    try {
      const path = nextMode === 'latest' ? '/api/earnings-events/latest' : '/api/earnings-events'
      setPayload(await requestClientJson(`${path}?${params.toString()}`))
    } catch (requestError) {
      setPayload(null)
      setError(errorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void loadEvents()
  }

  function selectMode(nextMode: EarningsMode) {
    if (nextMode === mode) return
    setMode(nextMode)
    if (nextMode === 'latest') setLatestOnly(false)
    void loadEvents(symbol, eventStatus, fiscalPeriod, nextMode, nextMode === 'pit' ? latestOnly : false)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadEvents('AAPL', '', '', 'pit', false), 0)
    return () => window.clearTimeout(timer)
    // The first render intentionally loads one known symbol for inspection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="page-stack">
      <section className="card">
        <div className="split-row">
          <div>
            <p className="eyebrow">Analyst workspace</p>
            <h1>Earnings Events</h1>
            <p className="small">{mode === 'latest' ? 'Latest enriched is non-PIT and must not be used for strict backtests.' : 'Canonical temporal observations. Known at is the source-cache observation date, not the earnings report date.'}</p>
          </div>
          <div className="small">Admin: {adminActor}</div>
        </div>

        <div className="chart-tabs" role="tablist" aria-label="Earnings event read mode">
          <button aria-selected={mode === 'pit'} className={mode === 'pit' ? 'primary' : 'secondary'} onClick={() => selectMode('pit')} role="tab" type="button">Temporal PIT</button>
          <button aria-selected={mode === 'latest'} className={mode === 'latest' ? 'primary' : 'secondary'} onClick={() => selectMode('latest')} role="tab" type="button">Latest enriched</button>
        </div>

        <form className="entity-layer-query" onSubmit={submit}>
          <div>
            <label htmlFor="earnings-events-symbol">Symbol</label>
            <input id="earnings-events-symbol" onChange={(event) => setSymbol(event.target.value)} value={symbol} />
          </div>
          <div>
            <label htmlFor="earnings-events-status">Event status</label>
            <select id="earnings-events-status" onChange={(event) => setEventStatus(event.target.value)} value={eventStatus}>
              <option value="">All statuses</option>
              <option value="reported">Reported</option>
              <option value="estimated">Estimated</option>
              <option value="scheduled">Scheduled</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
          <div>
            <label htmlFor="earnings-events-period">Fiscal period</label>
            <input id="earnings-events-period" onChange={(event) => setFiscalPeriod(event.target.value)} placeholder="2026Q2" value={fiscalPeriod} />
          </div>
          {mode === 'pit' ? <label className="entity-layer-query-action">
            <input checked={latestOnly} onChange={(event) => setLatestOnly(event.target.checked)} type="checkbox" />
            Latest only
          </label> : null}
          <div className="entity-layer-query-action">
            <button className="primary" disabled={loading} type="submit">{loading ? 'Loading' : 'Load'}</button>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="split-row">
          <div>
            <h2>Observations</h2>
            <p className="small">{response.symbol ?? symbol.trim().toUpperCase()} {loading ? 'loading' : `${response.count} rows`}{response.mode === 'latest' || response.isPointInTime === false ? ' | latest / non-PIT' : ''}</p>
          </div>
          <AvailabilityBadge available={response.available} />
        </div>
        {error ? <div className="error">Earnings events request failed: {error}</div> : null}
        {!loading && !error && response.reason ? <div className="small">{response.reason}</div> : null}
        <div className="table-wrap">
          <table className="registry-table">
            <thead>
              <tr>
                <th>Fiscal period</th>
                <th>Report date/time</th>
                <th>Status</th>
                <th>EPS actual / estimate / surprise</th>
                <th>Revenue actual / estimate</th>
                <th>Known at</th>
                <th>Source / primary</th>
                <th>Revenue provenance</th>
                <th>Quality flags</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <EmptyRow message="Loading earnings event observations..." /> : null}
              {!loading && !error && response.rows.length === 0 ? <EmptyRow message={response.available === false ? 'Earnings events read model is unavailable.' : 'No earnings event observations match these filters.'} /> : null}
              {!loading && !error ? response.rows.map((row) => (
                <tr key={row.eventId}>
                  <td><strong>{row.fiscalPeriod}</strong></td>
                  <td>{row.reportDate ?? '-'}<div className="small">{row.reportTime ?? '-'} {row.timezone ?? ''}</div></td>
                  <td><span className="badge muted">{row.eventStatus}</span><div className="small">{row.isConfirmed === true ? 'confirmed' : 'not confirmed'}</div></td>
                  <td>{formatNumber(row.epsActual)} / {formatNumber(row.epsEstimate)} / {formatNumber(row.epsSurprise)}</td>
                  <td>{formatNumber(row.revenueActual)} / {formatNumber(row.revenueEstimate)}</td>
                  <td>{row.knownAt ?? '-'}</td>
                  <td className="small">{row.source ?? '-'}<div>primary: {row.primarySource ?? '-'}</div></td>
                  <td className="small">{formatRevenueProvenance(row.sourceMetadata)}</td>
                  <td className="small">{formatFlags(row.dataQualityFlags)}</td>
                </tr>
              )) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function EmptyRow({ message }: { message: string }) {
  return <tr><td className="small" colSpan={9}>{message}</td></tr>
}

function AvailabilityBadge({ available }: { available: boolean | null }) {
  if (available === true) return <span className="badge completed">available</span>
  if (available === false) return <span className="badge failed">unavailable</span>
  return <span className="badge muted">not loaded</span>
}

function normalizeResponse(payload: unknown): EarningsResponse {
  const record = asRecord(payload)
  const rows = firstList<RowRecord>(payload, ['rows']).map(normalizeRow)
  return {
    available: typeof record?.available === 'boolean' ? record.available : null,
    reason: readString(record, ['reason']),
    symbol: readString(record, ['symbol']),
    count: readNumber(record?.count) ?? rows.length,
    mode: readString(record, ['mode']),
    isPointInTime: typeof record?.isPointInTime === 'boolean' ? record.isPointInTime : typeof record?.is_point_in_time === 'boolean' ? record.is_point_in_time : null,
    rows,
  }
}

function normalizeRow(value: RowRecord): EarningsRow {
  return {
    eventId: readString(value, ['eventId', 'event_id']) ?? '',
    fiscalPeriod: readString(value, ['fiscalPeriod', 'fiscal_period']) ?? '',
    reportDate: readString(value, ['reportDate', 'report_date']),
    reportTime: readString(value, ['reportTime', 'report_time']),
    timezone: readString(value, ['timezone']),
    eventStatus: readString(value, ['eventStatus', 'event_status']) ?? 'unknown',
    isConfirmed: typeof value.isConfirmed === 'boolean' ? value.isConfirmed : typeof value.is_confirmed === 'boolean' ? value.is_confirmed : null,
    epsActual: readNumber(value.epsActual ?? value.eps_actual),
    epsEstimate: readNumber(value.epsEstimate ?? value.eps_estimate),
    epsSurprise: readNumber(value.epsSurprise ?? value.eps_surprise),
    revenueActual: readNumber(value.revenueActual ?? value.revenue_actual),
    revenueEstimate: readNumber(value.revenueEstimate ?? value.revenue_estimate),
    knownAt: readString(value, ['knownAt', 'known_at']),
    source: readString(value, ['source']),
    primarySource: readString(value, ['primarySource', 'primary_source']),
    sourceMetadata: value.sourceMetadata ?? value.source_metadata ?? {},
    dataQualityFlags: value.dataQualityFlags ?? value.data_quality_flags ?? {},
  }
}

function readString(record: RowRecord | undefined | null, keys: string[]): string | null {
  for (const key of keys) {
    const value = record?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

function formatNumber(value: number | null): string {
  return value === null ? '-' : new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(value)
}

function formatFlags(value: unknown): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value as Record<string, unknown>).length === 0) return '-'
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function formatRevenueProvenance(value: unknown): string {
  const metadata = asRecord(value)
  const provenance = asRecord(metadata?.fieldProvenance ?? metadata?.field_provenance)
  const sources = sourceList(metadata?.contributingSources ?? metadata?.contributing_sources)
  const actual = readString(provenance, ['revenue_actual', 'revenueActual']) ?? '-'
  const estimate = readString(provenance, ['revenue_estimate', 'revenueEstimate']) ?? '-'
  return `sources: ${sources || '-'}; actual: ${actual}; estimate: ${estimate}`
}

function sourceList(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).join(', ')
}

function errorMessage(error: unknown): string {
  const record = asRecord(error)
  return readString(record, ['message', 'error', 'detail']) ?? (error instanceof Error ? error.message : 'Unknown error.')
}
