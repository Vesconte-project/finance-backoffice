'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { requestClientJson } from '@/lib/client-json'
import { asRecord, firstList, type RowRecord } from '@/lib/payload'

type Props = {
  adminActor: string
}

type StatementRow = {
  symbol: string
  statementType: string
  lineItemId: string
  displayLabel: string
  value: number | null
  currency: string | null
  periodType: string
  fiscalYear: number | null
  fiscalQuarter: string | null
  periodEnd: string | null
  knownAt: string | null
  source: string | null
  dataQualityFlags: unknown
}

type StatementResponse = {
  available: boolean | null
  reason: string | null
  symbol: string | null
  count: number
  rows: StatementRow[]
}

export function FinancialStatementsWorkspace({ adminActor }: Props) {
  const [symbol, setSymbol] = useState('AAPL')
  const [statementType, setStatementType] = useState('')
  const [periodType, setPeriodType] = useState('')
  const [payload, setPayload] = useState<unknown | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const response = useMemo(() => normalizeResponse(payload), [payload])

  async function loadStatements(nextSymbol = symbol, nextStatementType = statementType, nextPeriodType = periodType) {
    const normalizedSymbol = nextSymbol.trim().toUpperCase()
    if (!normalizedSymbol) {
      setPayload(null)
      setError('Enter a symbol.')
      return
    }

    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ symbol: normalizedSymbol, limit: '250' })
    if (nextStatementType) params.set('statementType', nextStatementType)
    if (nextPeriodType) params.set('periodType', nextPeriodType)
    try {
      setPayload(await requestClientJson(`/api/financial-statements?${params.toString()}`))
    } catch (requestError) {
      setPayload(null)
      setError(errorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void loadStatements()
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadStatements('AAPL', '', ''), 0)
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
            <h1>Financial Statements</h1>
            <p className="small">Canonical temporal line items. Known at is the source-cache observation date, not an official filing date.</p>
          </div>
          <div className="small">Admin: {adminActor}</div>
        </div>

        <form className="entity-layer-query" onSubmit={submit}>
          <div>
            <label htmlFor="financial-statements-symbol">Symbol</label>
            <input id="financial-statements-symbol" onChange={(event) => setSymbol(event.target.value)} value={symbol} />
          </div>
          <div>
            <label htmlFor="financial-statements-type">Statement type</label>
            <select id="financial-statements-type" onChange={(event) => setStatementType(event.target.value)} value={statementType}>
              <option value="">All statements</option>
              <option value="income_statement">Income statement</option>
              <option value="balance_sheet">Balance sheet</option>
              <option value="cash_flow">Cash flow</option>
            </select>
          </div>
          <div>
            <label htmlFor="financial-statements-period">Period type</label>
            <select id="financial-statements-period" onChange={(event) => setPeriodType(event.target.value)} value={periodType}>
              <option value="">Annual and quarterly</option>
              <option value="annual">Annual</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </div>
          <div className="entity-layer-query-action">
            <button className="primary" disabled={loading} type="submit">{loading ? 'Loading' : 'Load'}</button>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="split-row">
          <div>
            <h2>Line items</h2>
            <p className="small">{response.symbol ?? symbol.trim().toUpperCase()} {loading ? 'loading' : `${response.count} rows`}</p>
          </div>
          <AvailabilityBadge available={response.available} />
        </div>

        {error ? <div className="error">Financial statements request failed: {error}</div> : null}
        {!loading && !error && response.reason ? <div className="small">{response.reason}</div> : null}
        <div className="table-wrap">
          <table className="registry-table">
            <thead>
              <tr>
                <th>Line item</th>
                <th>Value</th>
                <th>Currency</th>
                <th>Fiscal period</th>
                <th>Period end</th>
                <th>Known at</th>
                <th>Source</th>
                <th>Quality flags</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <EmptyRow message="Loading financial statement rows..." /> : null}
              {!loading && !error && response.rows.length === 0 ? <EmptyRow message={response.available === false ? 'Financial statements read model is unavailable.' : 'No financial statement rows match these filters.'} /> : null}
              {!loading && !error ? response.rows.map((row, index) => (
                <tr key={`${row.symbol}-${row.statementType}-${row.lineItemId}-${row.periodType}-${row.periodEnd}-${row.knownAt}-${index}`}>
                  <td><strong>{row.displayLabel || row.lineItemId}</strong><div className="small">{row.statementType} · {row.lineItemId}</div></td>
                  <td>{formatValue(row.value)}</td>
                  <td>{row.currency ?? '—'}</td>
                  <td>{formatFiscalPeriod(row)}</td>
                  <td>{formatDate(row.periodEnd)}</td>
                  <td>{formatDate(row.knownAt)}</td>
                  <td className="small">{row.source ?? '—'}</td>
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

function normalizeResponse(payload: unknown): StatementResponse {
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

function normalizeRow(value: RowRecord): StatementRow {
  return {
    symbol: readString(value, ['symbol']) ?? '',
    statementType: readString(value, ['statementType', 'statement_type']) ?? '',
    lineItemId: readString(value, ['lineItemId', 'line_item_id']) ?? '',
    displayLabel: readString(value, ['displayLabel', 'display_label']) ?? '',
    value: readNumber(value.value),
    currency: readString(value, ['currency']),
    periodType: readString(value, ['periodType', 'period_type']) ?? '',
    fiscalYear: readNumber(value.fiscalYear ?? value.fiscal_year),
    fiscalQuarter: readString(value, ['fiscalQuarter', 'fiscal_quarter']),
    periodEnd: readString(value, ['periodEnd', 'period_end']),
    knownAt: readString(value, ['knownAt', 'known_at']),
    source: readString(value, ['source']),
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
  return value === null ? '—' : new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(value)
}

function formatFiscalPeriod(row: StatementRow): string {
  const fiscalYear = row.fiscalYear ? `FY ${row.fiscalYear}` : '—'
  return row.fiscalQuarter ? `${fiscalYear} ${row.fiscalQuarter} · ${row.periodType}` : `${fiscalYear} · ${row.periodType}`
}

function formatDate(value: string | null): string {
  return value || '—'
}

function formatFlags(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value as Record<string, unknown>).length === 0) return '—'
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function errorMessage(error: unknown): string {
  const record = asRecord(error)
  return readString(record, ['message', 'error', 'detail']) ?? (error instanceof Error ? error.message : 'Unknown error.')
}
