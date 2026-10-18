'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { requestClientJson } from '@/lib/client-json'
import { asRecord, firstList, type RowRecord } from '@/lib/payload'

type Props = { adminActor: string }

type CorporateActionRow = {
  eventId: string
  actionType: string
  exDate: string | null
  knownAt: string | null
  paymentDate: string | null
  recordDate: string | null
  declarationDate: string | null
  cashAmount: number | null
  adjustedCashAmount: number | null
  frequency: string | null
  splitFactor: number | null
  splitNumerator: number | null
  splitDenominator: number | null
  splitRatioText: string | null
  source: string | null
  primarySource: string | null
  sourceMetadata: unknown
  dataQualityFlags: unknown
}

type CorporateActionsResponse = {
  available: boolean | null
  reason: string | null
  symbol: string | null
  count: number
  rows: CorporateActionRow[]
}

export function CorporateActionsWorkspace({ adminActor }: Props) {
  const [symbol, setSymbol] = useState('AAPL')
  const [actionType, setActionType] = useState('')
  const [asOf, setAsOf] = useState('')
  const [latestOnly, setLatestOnly] = useState(true)
  const [limit, setLimit] = useState('50')
  const [payload, setPayload] = useState<unknown | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const response = useMemo(() => normalizeResponse(payload), [payload])

  async function loadActions(
    nextSymbol = symbol,
    nextActionType = actionType,
    nextAsOf = asOf,
    nextLatestOnly = latestOnly,
    nextLimit = limit,
  ) {
    const normalizedSymbol = nextSymbol.trim().toUpperCase()
    if (!normalizedSymbol) {
      setPayload(null)
      setError('Enter a symbol.')
      return
    }
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({
      symbol: normalizedSymbol,
      latestOnly: String(nextLatestOnly),
      limit: String(normalizeLimit(nextLimit)),
    })
    if (nextActionType) params.set('actionType', nextActionType)
    if (nextAsOf) params.set('asOf', nextAsOf)
    try {
      setPayload(await requestClientJson(`/api/corporate-actions?${params.toString()}`))
    } catch (requestError) {
      setPayload(null)
      setError(errorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void loadActions()
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadActions('AAPL', '', '', true, '50'), 0)
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
            <h1>Corporate Actions</h1>
            <p className="small">Temporal PIT canonical events. Known at is the observation date; this is not a latest enriched view.</p>
          </div>
          <div className="small">Admin: {adminActor}</div>
        </div>

        <form className="entity-layer-query" onSubmit={submit}>
          <div>
            <label htmlFor="corporate-actions-symbol">Symbol</label>
            <input id="corporate-actions-symbol" onChange={(event) => setSymbol(event.target.value)} value={symbol} />
          </div>
          <div>
            <label htmlFor="corporate-actions-type">Action type</label>
            <select id="corporate-actions-type" onChange={(event) => setActionType(event.target.value)} value={actionType}>
              <option value="">All actions</option>
              <option value="dividend">Dividend</option>
              <option value="split">Split</option>
            </select>
          </div>
          <div>
            <label htmlFor="corporate-actions-as-of">As of</label>
            <input id="corporate-actions-as-of" onChange={(event) => setAsOf(event.target.value)} type="date" value={asOf} />
          </div>
          <div>
            <label htmlFor="corporate-actions-limit">Limit</label>
            <input id="corporate-actions-limit" max="500" min="1" onChange={(event) => setLimit(event.target.value)} type="number" value={limit} />
          </div>
          <label className="entity-layer-query-action">
            <input checked={latestOnly} onChange={(event) => setLatestOnly(event.target.checked)} type="checkbox" />
            Latest snapshot per event
          </label>
          <div className="entity-layer-query-action">
            <button className="primary" disabled={loading} type="submit">{loading ? 'Loading' : 'Load'}</button>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="split-row">
          <div>
            <h2>Canonical actions</h2>
            <p className="small">{response.symbol ?? symbol.trim().toUpperCase()} {loading ? 'loading' : `${response.count} rows`}</p>
          </div>
          <AvailabilityBadge available={response.available} />
        </div>
        {error ? <div className="error">Corporate actions request failed: {error}</div> : null}
        {!loading && !error && response.available === false ? <div className="small">{response.reason ?? 'Corporate actions read model is unavailable.'}</div> : null}
        <div className="table-wrap">
          <table className="registry-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Ex date / known at</th>
                <th>Dividend details</th>
                <th>Split details</th>
                <th>Source / primary</th>
                <th>Provenance</th>
                <th>Quality flags</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <EmptyRow message="Loading canonical corporate actions..." /> : null}
              {!loading && !error && response.rows.length === 0 ? <EmptyRow message={response.available === false ? 'Corporate actions read model is unavailable.' : 'Sem corporate actions canonical seguros para este filtro.'} /> : null}
              {!loading && !error ? response.rows.map((row) => (
                <tr key={row.eventId}>
                  <td><span className="badge muted">{row.actionType}</span></td>
                  <td>{row.exDate ?? '-'}<div className="small">known: {row.knownAt ?? '-'}</div></td>
                  <td className="small">{formatDividendDetails(row)}</td>
                  <td className="small">{formatSplitDetails(row)}</td>
                  <td className="small">{row.source ?? '-'}<div>primary: {row.primarySource ?? '-'}</div></td>
                  <td className="small">{formatProvenance(row.sourceMetadata, row.actionType)}</td>
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
  return <tr><td className="small" colSpan={7}>{message}</td></tr>
}

function AvailabilityBadge({ available }: { available: boolean | null }) {
  if (available === true) return <span className="badge completed">available</span>
  if (available === false) return <span className="badge failed">unavailable</span>
  return <span className="badge muted">not loaded</span>
}

function normalizeResponse(payload: unknown): CorporateActionsResponse {
  const record = asRecord(payload)
  const rows = firstList<RowRecord>(payload, ['rows']).map(normalizeRow)
  return {
    available: typeof record?.available === 'boolean' ? record.available : null,
    reason: readString(record, ['reason']),
    symbol: readString(record, ['symbol']),
    count: readNumber(record?.count) ?? rows.length,
    rows,
  }
}

function normalizeRow(value: RowRecord): CorporateActionRow {
  return {
    eventId: readString(value, ['eventId', 'event_id']) ?? '',
    actionType: readString(value, ['actionType', 'action_type']) ?? 'unknown',
    exDate: readString(value, ['exDate', 'ex_date']),
    knownAt: readString(value, ['knownAt', 'known_at']),
    paymentDate: readString(value, ['paymentDate', 'payment_date']),
    recordDate: readString(value, ['recordDate', 'record_date']),
    declarationDate: readString(value, ['declarationDate', 'declaration_date']),
    cashAmount: readNumber(value.cashAmount ?? value.cash_amount),
    adjustedCashAmount: readNumber(value.adjustedCashAmount ?? value.adjusted_cash_amount),
    frequency: readString(value, ['frequency']),
    splitFactor: readNumber(value.splitFactor ?? value.split_factor),
    splitNumerator: readNumber(value.splitNumerator ?? value.split_numerator),
    splitDenominator: readNumber(value.splitDenominator ?? value.split_denominator),
    splitRatioText: readString(value, ['splitRatioText', 'split_ratio_text']),
    source: readString(value, ['source']),
    primarySource: readString(value, ['primarySource', 'primary_source']),
    sourceMetadata: value.sourceMetadata ?? value.source_metadata ?? {},
    dataQualityFlags: value.dataQualityFlags ?? value.data_quality_flags ?? {},
  }
}

function normalizeLimit(value: string): number {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? Math.max(1, Math.min(500, parsed)) : 50
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

function formatDividendDetails(row: CorporateActionRow): string {
  if (row.actionType !== 'dividend') return '-'
  return `cash: ${formatNumber(row.cashAmount)}; adjusted: ${formatNumber(row.adjustedCashAmount)}; payment: ${row.paymentDate ?? '-'}; record: ${row.recordDate ?? '-'}; declaration: ${row.declarationDate ?? '-'}; frequency: ${row.frequency ?? '-'}`
}

function formatSplitDetails(row: CorporateActionRow): string {
  if (row.actionType !== 'split') return '-'
  return `factor: ${formatNumber(row.splitFactor)}; numerator: ${formatNumber(row.splitNumerator)}; denominator: ${formatNumber(row.splitDenominator)}; ratio: ${row.splitRatioText ?? '-'}`
}

function formatNumber(value: number | null): string {
  return value === null ? '-' : new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(value)
}

function formatProvenance(value: unknown, actionType: string): string {
  const metadata = asRecord(value)
  const provenance = asRecord(metadata?.fieldProvenance ?? metadata?.field_provenance)
  const sources = sourceList(metadata?.contributingSources ?? metadata?.contributing_sources)
  const fields = actionType === 'dividend' ? ['cash_amount', 'payment_date', 'record_date'] : ['split_factor', 'split_numerator', 'split_denominator']
  const details = fields.map((field) => `${field}: ${readString(provenance, [field, toCamelCase(field)]) ?? '-'}`).join('; ')
  return `sources: ${sources || '-'}; ${details}`
}

function sourceList(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).join(', ')
}

function toCamelCase(value: string): string {
  return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
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
