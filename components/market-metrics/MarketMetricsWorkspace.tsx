'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { requestClientJson } from '@/lib/client-json'
import { asRecord, firstList, type RowRecord } from '@/lib/payload'

type Props = {
  adminActor: string
}

type MarketMetricRow = {
  symbol: string
  metric: string
  value: number | null
  currency: string | null
  observationDate: string | null
  knownAt: string | null
  source: string | null
  methodologyVersion: string | null
  dataQualityFlags: unknown
}

type MarketMetricsResponse = {
  available: boolean | null
  reason: string | null
  symbol: string | null
  count: number
  rows: MarketMetricRow[]
}

export function MarketMetricsWorkspace({ adminActor }: Props) {
  const [symbol, setSymbol] = useState('AAPL')
  const [metric, setMetric] = useState('')
  const [latestOnly, setLatestOnly] = useState(false)
  const [payload, setPayload] = useState<unknown | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const response = useMemo(() => normalizeResponse(payload), [payload])

  async function loadMetrics(nextSymbol = symbol, nextMetric = metric, nextLatestOnly = latestOnly) {
    const normalizedSymbol = nextSymbol.trim().toUpperCase()
    if (!normalizedSymbol) {
      setPayload(null)
      setError('Enter a symbol.')
      return
    }

    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ symbol: normalizedSymbol, limit: '250', latestOnly: String(nextLatestOnly) })
    if (nextMetric.trim()) params.set('metric', nextMetric.trim().toLowerCase())
    try {
      setPayload(await requestClientJson(`/api/market-metrics?${params.toString()}`))
    } catch (requestError) {
      setPayload(null)
      setError(errorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void loadMetrics()
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadMetrics('AAPL', '', false), 0)
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
            <h1>Market Metrics</h1>
            <p className="small">Canonical temporal observations. Known at is the source-cache observation date, not an official filing date.</p>
          </div>
          <div className="small">Admin: {adminActor}</div>
        </div>

        <form className="entity-layer-query" onSubmit={submit}>
          <div>
            <label htmlFor="market-metrics-symbol">Symbol</label>
            <input id="market-metrics-symbol" onChange={(event) => setSymbol(event.target.value)} value={symbol} />
          </div>
          <div>
            <label htmlFor="market-metrics-metric">Metric</label>
            <input id="market-metrics-metric" onChange={(event) => setMetric(event.target.value)} placeholder="market_cap" value={metric} />
          </div>
          <label className="entity-layer-query-action">
            <input checked={latestOnly} onChange={(event) => setLatestOnly(event.target.checked)} type="checkbox" />
            Latest only
          </label>
          <div className="entity-layer-query-action">
            <button className="primary" disabled={loading} type="submit">{loading ? 'Loading' : 'Load'}</button>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="split-row">
          <div>
            <h2>Observations</h2>
            <p className="small">{response.symbol ?? symbol.trim().toUpperCase()} {loading ? 'loading' : `${response.count} rows`}</p>
          </div>
          <AvailabilityBadge available={response.available} />
        </div>

        {error ? <div className="error">Market metrics request failed: {error}</div> : null}
        {!loading && !error && response.reason ? <div className="small">{response.reason}</div> : null}
        <div className="table-wrap">
          <table className="registry-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Value</th>
                <th>Currency</th>
                <th>Observation date</th>
                <th>Known at</th>
                <th>Source</th>
                <th>Methodology</th>
                <th>Quality flags</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <EmptyRow message="Loading market metric observations..." /> : null}
              {!loading && !error && response.rows.length === 0 ? <EmptyRow message={response.available === false ? 'Market metrics read model is unavailable.' : 'No market metric observations match these filters.'} /> : null}
              {!loading && !error ? response.rows.map((row, index) => (
                <tr key={`${row.symbol}-${row.metric}-${row.observationDate}-${row.knownAt}-${index}`}>
                  <td><strong>{row.metric}</strong></td>
                  <td>{formatValue(row.value)}</td>
                  <td>{row.currency ?? '-'}</td>
                  <td>{row.observationDate ?? '-'}</td>
                  <td>{row.knownAt ?? '-'}</td>
                  <td className="small">{row.source ?? '-'}</td>
                  <td className="small">{row.methodologyVersion ?? '-'}</td>
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
  return <tr><td className="small" colSpan={8}>{message}</td></tr>
}

function AvailabilityBadge({ available }: { available: boolean | null }) {
  if (available === true) return <span className="badge completed">available</span>
  if (available === false) return <span className="badge failed">unavailable</span>
  return <span className="badge muted">not loaded</span>
}

function normalizeResponse(payload: unknown): MarketMetricsResponse {
  const record = asRecord(payload)
  const rows = firstList<RowRecord>(payload, ['rows']).map(normalizeRow)
  return {
    available: readBoolean(record?.available),
    reason: readString(record, ['reason']),
    symbol: readString(record, ['symbol']),
    count: readNumber(record?.count) ?? rows.length,
    rows,
  }
}

function normalizeRow(value: RowRecord): MarketMetricRow {
  return {
    symbol: readString(value, ['symbol']) ?? '',
    metric: readString(value, ['metric']) ?? '',
    value: readNumber(value.value),
    currency: readString(value, ['currency']),
    observationDate: readString(value, ['observationDate', 'observation_date']),
    knownAt: readString(value, ['knownAt', 'known_at']),
    source: readString(value, ['source']),
    methodologyVersion: readString(value, ['methodologyVersion', 'methodology_version']),
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

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function formatValue(value: number | null): string {
  return value === null ? '-' : new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(value)
}

function formatFlags(value: unknown): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value as Record<string, unknown>).length === 0) return '-'
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function errorMessage(error: unknown): string {
  const record = asRecord(error)
  return readString(record, ['message', 'error', 'detail']) ?? (error instanceof Error ? error.message : 'Unknown error.')
}
