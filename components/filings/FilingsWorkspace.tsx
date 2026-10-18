'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { requestClientJson } from '@/lib/client-json'
import { asRecord, firstList, type RowRecord } from '@/lib/payload'

type Props = { adminActor: string }

type FilingRow = {
  eventId: string
  cik: string | null
  accessionNumber: string | null
  formType: string | null
  filingDate: string | null
  reportDate: string | null
  acceptanceDatetime: string | null
  primaryDocument: string | null
  primaryDocDescription: string | null
  filingUrl: string | null
  source: string | null
  primarySource: string | null
  knownAt: string | null
  ingestedAt: string | null
  methodologyVersion: string | null
  sourceMetadata: unknown
  dataQualityFlags: unknown
}

type FilingsResponse = {
  available: boolean | null
  reason: string | null
  symbol: string | null
  count: number
  rows: FilingRow[]
}

export function FilingsWorkspace({ adminActor }: Props) {
  const [symbol, setSymbol] = useState('AAPL')
  const [formType, setFormType] = useState('')
  const [asOf, setAsOf] = useState('')
  const [latestOnly, setLatestOnly] = useState(true)
  const [limit, setLimit] = useState('100')
  const [payload, setPayload] = useState<unknown | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const response = useMemo(() => normalizeResponse(payload), [payload])

  async function loadFilings(
    nextSymbol = symbol,
    nextFormType = formType,
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
    if (nextFormType.trim()) params.set('formType', nextFormType.trim().toUpperCase())
    if (nextAsOf) params.set('asOf', nextAsOf)
    try {
      setPayload(await requestClientJson(`/api/filings?${params.toString()}`))
    } catch (requestError) {
      setPayload(null)
      setError(errorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void loadFilings()
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadFilings('AAPL', '', '', true, '100'), 0)
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
            <h1>Filings</h1>
            <p className="small">Temporal PIT canonical filing metadata. Known at is the observation date.</p>
          </div>
          <div className="small">Admin: {adminActor}</div>
        </div>

        <form className="entity-layer-query" onSubmit={submit}>
          <div>
            <label htmlFor="filings-symbol">Symbol</label>
            <input id="filings-symbol" onChange={(event) => setSymbol(event.target.value)} value={symbol} />
          </div>
          <div>
            <label htmlFor="filings-form-type">Form type</label>
            <input id="filings-form-type" onChange={(event) => setFormType(event.target.value)} placeholder="10-K" value={formType} />
          </div>
          <div>
            <label htmlFor="filings-as-of">As of</label>
            <input id="filings-as-of" onChange={(event) => setAsOf(event.target.value)} type="date" value={asOf} />
          </div>
          <div>
            <label htmlFor="filings-limit">Limit</label>
            <input id="filings-limit" max="500" min="1" onChange={(event) => setLimit(event.target.value)} type="number" value={limit} />
          </div>
          <label className="entity-layer-query-action">
            <input checked={latestOnly} onChange={(event) => setLatestOnly(event.target.checked)} type="checkbox" />
            Latest snapshot per accession
          </label>
          <div className="entity-layer-query-action">
            <button className="primary" disabled={loading} type="submit">{loading ? 'Loading' : 'Load'}</button>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="split-row">
          <div>
            <h2>Canonical filings</h2>
            <p className="small">{response.symbol ?? symbol.trim().toUpperCase()} {loading ? 'loading' : `${response.count} rows`}</p>
          </div>
          <AvailabilityBadge available={response.available} />
        </div>
        {error ? <div className="error">Filings request failed: {error}</div> : null}
        {!loading && !error && response.available === false ? <div className="small">{response.reason ?? 'Filings read model is unavailable.'}</div> : null}
        <div className="table-wrap">
          <table className="registry-table">
            <thead>
              <tr>
                <th>Form / accession</th>
                <th>Filing / report / accepted</th>
                <th>CIK</th>
                <th>Primary document</th>
                <th>Source / primary</th>
                <th>Known at</th>
                <th>Provenance</th>
                <th>Methodology</th>
                <th>Quality flags</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <EmptyRow message="Loading canonical filings..." /> : null}
              {!loading && !error && response.rows.length === 0 ? <EmptyRow message={response.available === false ? 'Filings read model is unavailable.' : 'Sem filings canonical para este filtro.'} /> : null}
              {!loading && !error ? response.rows.map((row) => (
                <tr key={row.eventId}>
                  <td><strong>{row.formType ?? '-'}</strong><div className="small">{row.accessionNumber ?? '-'}</div></td>
                  <td>{row.filingDate ?? '-'}<div className="small">report: {row.reportDate ?? '-'}</div><div className="small">accepted: {row.acceptanceDatetime ?? '-'}</div></td>
                  <td className="small">{row.cik ?? '-'}</td>
                  <td className="small"><strong>{row.primaryDocument ?? '-'}</strong><div>{row.primaryDocDescription ?? '-'}</div>{row.filingUrl ? <a href={row.filingUrl} rel="noreferrer" target="_blank">Open filing</a> : null}</td>
                  <td className="small">{row.source ?? '-'}<div>primary: {row.primarySource ?? '-'}</div></td>
                  <td>{row.knownAt ?? '-'}<div className="small">ingested: {row.ingestedAt ?? '-'}</div></td>
                  <td className="small">{formatProvenance(row.sourceMetadata)}</td>
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
  return <tr><td className="small" colSpan={9}>{message}</td></tr>
}

function AvailabilityBadge({ available }: { available: boolean | null }) {
  if (available === true) return <span className="badge completed">available</span>
  if (available === false) return <span className="badge failed">unavailable</span>
  return <span className="badge muted">not loaded</span>
}

function normalizeResponse(payload: unknown): FilingsResponse {
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

function normalizeRow(value: RowRecord): FilingRow {
  return {
    eventId: readString(value, ['eventId', 'event_id']) ?? '',
    cik: readString(value, ['cik']),
    accessionNumber: readString(value, ['accessionNumber', 'accession_number']),
    formType: readString(value, ['formType', 'form_type']),
    filingDate: readString(value, ['filingDate', 'filing_date']),
    reportDate: readString(value, ['reportDate', 'report_date']),
    acceptanceDatetime: readString(value, ['acceptanceDatetime', 'acceptance_datetime']),
    primaryDocument: readString(value, ['primaryDocument', 'primary_document']),
    primaryDocDescription: readString(value, ['primaryDocDescription', 'primary_doc_description']),
    filingUrl: readString(value, ['filingUrl', 'filing_url']),
    source: readString(value, ['source']),
    primarySource: readString(value, ['primarySource', 'primary_source']),
    knownAt: readString(value, ['knownAt', 'known_at']),
    ingestedAt: readString(value, ['ingestedAt', 'ingested_at']),
    methodologyVersion: readString(value, ['methodologyVersion', 'methodology_version']),
    sourceMetadata: value.sourceMetadata ?? value.source_metadata ?? {},
    dataQualityFlags: value.dataQualityFlags ?? value.data_quality_flags ?? {},
  }
}

function normalizeLimit(value: string): number {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? Math.max(1, Math.min(500, parsed)) : 100
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

function formatProvenance(value: unknown): string {
  const metadata = asRecord(value)
  const sources = sourceList(metadata?.contributingSources ?? metadata?.contributing_sources)
  const provenance = asRecord(metadata?.fieldProvenance ?? metadata?.field_provenance)
  const details = ['filing_date', 'report_date', 'form_type'].map((field) => `${field}: ${readString(provenance, [field, toCamelCase(field)]) ?? '-'}`).join('; ')
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
