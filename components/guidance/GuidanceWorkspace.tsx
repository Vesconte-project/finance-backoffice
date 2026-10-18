'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { requestClientJson } from '@/lib/client-json'
import { asRecord, firstList, type RowRecord } from '@/lib/payload'

type Props = { adminActor: string }

type GuidanceRow = {
  eventId: string
  symbol: string | null
  guidanceType: string | null
  metricLabel: string | null
  periodLabel: string | null
  fiscalYear: number | null
  fiscalQuarter: number | null
  periodStart: string | null
  periodEnd: string | null
  valueType: string | null
  valuePoint: number | null
  valueLow: number | null
  valueHigh: number | null
  unitRaw: string | null
  currency: string | null
  basisRaw: string | null
  qualitativeDirection: string | null
  guidanceQuote: string | null
  quoteLocator: string | null
  sourceDocumentType: string | null
  sourceTitle: string | null
  sourceDocumentUrl: string | null
  relatedFilingAccession: string | null
  relatedFilingForm: string | null
  relatedFilingUrl: string | null
  source: string | null
  primarySource: string | null
  sourceMetadata: unknown
  dataQualityFlags: unknown
  extractionConfidence: string | null
  knownAt: string | null
  ingestedAt: string | null
  methodologyVersion: string | null
}

type GuidanceResponse = {
  available: boolean | null
  reason: string | null
  symbol: string | null
  count: number
  rows: GuidanceRow[]
}

export function GuidanceWorkspace({ adminActor }: Props) {
  const [symbol, setSymbol] = useState('ASML')
  const [guidanceType, setGuidanceType] = useState('')
  const [sourceDocumentType, setSourceDocumentType] = useState('')
  const [asOf, setAsOf] = useState('')
  const [latestOnly, setLatestOnly] = useState(true)
  const [limit, setLimit] = useState('100')
  const [payload, setPayload] = useState<unknown | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const response = useMemo(() => normalizeResponse(payload), [payload])

  async function loadGuidance(
    nextSymbol = symbol,
    nextGuidanceType = guidanceType,
    nextSourceDocumentType = sourceDocumentType,
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
    if (nextGuidanceType.trim()) params.set('guidanceType', nextGuidanceType.trim())
    if (nextSourceDocumentType.trim()) params.set('sourceDocumentType', nextSourceDocumentType.trim())
    if (nextAsOf) params.set('asOf', nextAsOf)
    try {
      setPayload(await requestClientJson(`/api/guidance?${params.toString()}`))
    } catch (requestError) {
      setPayload(null)
      setError(errorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void loadGuidance()
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadGuidance('ASML', '', '', '', true, '100'), 0)
    return () => window.clearTimeout(timer)
    // The first render intentionally loads a symbol with candidate guidance for inspection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="page-stack">
      <section className="card">
        <div className="split-row">
          <div>
            <p className="eyebrow">Analyst workspace</p>
            <h1>Guidance</h1>
            <p className="small">Temporal PIT canonical guidance candidates. Known at is the observation date, not confirmation of published company guidance.</p>
          </div>
          <div className="small">Admin: {adminActor}</div>
        </div>

        <form className="entity-layer-query" onSubmit={submit}>
          <div>
            <label htmlFor="guidance-symbol">Symbol</label>
            <input id="guidance-symbol" onChange={(event) => setSymbol(event.target.value)} value={symbol} />
          </div>
          <div>
            <label htmlFor="guidance-type">Guidance type</label>
            <input id="guidance-type" onChange={(event) => setGuidanceType(event.target.value)} placeholder="Optional canonical type" value={guidanceType} />
          </div>
          <div>
            <label htmlFor="guidance-document-type">Source document type</label>
            <input id="guidance-document-type" onChange={(event) => setSourceDocumentType(event.target.value)} placeholder="sec_filing_candidate" value={sourceDocumentType} />
          </div>
          <div>
            <label htmlFor="guidance-as-of">As of</label>
            <input id="guidance-as-of" onChange={(event) => setAsOf(event.target.value)} type="date" value={asOf} />
          </div>
          <div>
            <label htmlFor="guidance-limit">Limit</label>
            <input id="guidance-limit" max="500" min="1" onChange={(event) => setLimit(event.target.value)} type="number" value={limit} />
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
            <h2>Canonical guidance candidates</h2>
            <p className="small">{response.symbol ?? symbol.trim().toUpperCase()} {loading ? 'loading' : `${response.count} rows`}</p>
          </div>
          <AvailabilityBadge available={response.available} />
        </div>
        {error ? <div className="error">Guidance request failed: {error}</div> : null}
        {!loading && !error && response.available === false ? <div className="small">{response.reason ?? 'Guidance read model is unavailable.'}</div> : null}
        <div className="table-wrap">
          <table className="registry-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Value</th>
                <th>Fiscal period</th>
                <th>Direction / basis</th>
                <th>Quote</th>
                <th>Documents</th>
                <th>Confidence</th>
                <th>Source / known at</th>
                <th>Provenance</th>
                <th>Flags / methodology</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <EmptyRow message="Loading canonical guidance..." /> : null}
              {!loading && !error && response.rows.length === 0 ? <EmptyRow message={response.available === false ? 'Guidance read model is unavailable.' : response.reason ?? 'Sem guidance canonical para este filtro.'} /> : null}
              {!loading && !error ? response.rows.map((row) => (
                <tr key={row.eventId}>
                  <td>
                    <strong>{row.metricLabel ?? '-'}</strong>
                    <div className="small">{row.guidanceType ?? 'type unavailable'}</div>
                    <CandidateBadges flags={row.dataQualityFlags} />
                    <div className="small">{row.eventId}</div>
                  </td>
                  <td className="small">{formatValue(row)}<div>{row.valueType ?? '-'}</div></td>
                  <td className="small">
                    {row.periodLabel ?? '-'}
                    <div>FY: {row.fiscalYear ?? '-'} Q: {row.fiscalQuarter ?? '-'}</div>
                    <div>{row.periodStart ?? '-'} to {row.periodEnd ?? '-'}</div>
                  </td>
                  <td className="small">{row.qualitativeDirection ?? '-'}<div>basis: {row.basisRaw ?? '-'}</div></td>
                  <td className="small"><strong>{row.guidanceQuote ?? '-'}</strong><div>locator: {row.quoteLocator ?? '-'}</div></td>
                  <td className="small">
                    {row.sourceDocumentType ?? '-'}
                    <div>{row.sourceTitle ?? '-'}</div>
                    {row.sourceDocumentUrl ? <ExternalLink href={row.sourceDocumentUrl} label="Open source" /> : null}
                    <div>{row.relatedFilingForm ?? '-'} {row.relatedFilingAccession ? `/${row.relatedFilingAccession}` : ''}</div>
                    {row.relatedFilingUrl ? <ExternalLink href={row.relatedFilingUrl} label="Open filing" /> : null}
                  </td>
                  <td><span className="badge muted">{row.extractionConfidence ?? 'unknown'}</span></td>
                  <td className="small">{row.source ?? '-'}<div>primary: {row.primarySource ?? '-'}</div><div>known: {row.knownAt ?? '-'}</div><div>ingested: {row.ingestedAt ?? '-'}</div></td>
                  <td className="small"><ProvenanceDetails value={row.sourceMetadata} /></td>
                  <td className="small"><FlagsDetails flags={row.dataQualityFlags} methodology={row.methodologyVersion} /></td>
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
  return <tr><td className="small" colSpan={10}>{message}</td></tr>
}

function AvailabilityBadge({ available }: { available: boolean | null }) {
  if (available === true) return <span className="badge completed">available</span>
  if (available === false) return <span className="badge failed">unavailable</span>
  return <span className="badge muted">not loaded</span>
}

function CandidateBadges({ flags }: { flags: unknown }) {
  const record = asRecord(flags)
  if (record?.guidanceCandidate !== true && record?.confirmed !== false) return null
  return (
    <div>
      {record?.guidanceCandidate === true ? <span className="badge muted">candidate</span> : null}
      {record?.confirmed === false ? <span className="badge failed">unconfirmed</span> : null}
    </div>
  )
}

function ExternalLink({ href, label }: { href: string, label: string }) {
  return <a href={href} rel="noreferrer" target="_blank">{label}</a>
}

function ProvenanceDetails({ value }: { value: unknown }) {
  const metadata = asRecord(value)
  const sources = stringList(metadata?.contributingSources ?? metadata?.contributing_sources)
  const provenance = asRecord(metadata?.fieldProvenance ?? metadata?.field_provenance)
  const providerObservations = metadata?.providerObservations ?? metadata?.provider_observations
  const observations = Array.isArray(providerObservations) ? providerObservations : []
  const provenanceText = provenance && Object.keys(provenance).length > 0 ? JSON.stringify(provenance) : '-'
  return (
    <details>
      <summary>sources: {sources || '-'}; fields: {provenance ? Object.keys(provenance).length : 0}; observations: {observations.length}</summary>
      <div>fieldProvenance: {provenanceText}</div>
      <div>contributingSources: {sources || '-'}</div>
      <div>providerObservations: {observations.length ? JSON.stringify(observations) : '-'}</div>
    </details>
  )
}

function FlagsDetails({ flags, methodology }: { flags: unknown, methodology: string | null }) {
  return (
    <details>
      <summary>{methodology ?? '-'}</summary>
      <div>dataQualityFlags: {formatJson(flags)}</div>
    </details>
  )
}

function formatValue(row: GuidanceRow): string {
  const unit = [row.currency, row.unitRaw].filter((value): value is string => Boolean(value)).join(' ')
  if (row.valuePoint !== null) return `${formatNumber(row.valuePoint)}${unit ? ` ${unit}` : ''}`
  if (row.valueLow !== null || row.valueHigh !== null) return `${formatNumber(row.valueLow)} to ${formatNumber(row.valueHigh)}${unit ? ` ${unit}` : ''}`
  return unit || '-'
}

function formatNumber(value: number | null): string {
  return value === null ? '-' : new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(value)
}

function normalizeResponse(payload: unknown): GuidanceResponse {
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

function normalizeRow(value: RowRecord): GuidanceRow {
  return {
    eventId: readString(value, ['eventId', 'event_id']) ?? '',
    symbol: readString(value, ['symbol']),
    guidanceType: readString(value, ['guidanceType', 'guidance_type']),
    metricLabel: readString(value, ['metricLabel', 'metric_label']),
    periodLabel: readString(value, ['periodLabel', 'period_label']),
    fiscalYear: readNumber(value.fiscalYear ?? value.fiscal_year),
    fiscalQuarter: readNumber(value.fiscalQuarter ?? value.fiscal_quarter),
    periodStart: readString(value, ['periodStart', 'period_start']),
    periodEnd: readString(value, ['periodEnd', 'period_end']),
    valueType: readString(value, ['valueType', 'value_type']),
    valuePoint: readNumber(value.valuePoint ?? value.value_point),
    valueLow: readNumber(value.valueLow ?? value.value_low),
    valueHigh: readNumber(value.valueHigh ?? value.value_high),
    unitRaw: readString(value, ['unitRaw', 'unit_raw']),
    currency: readString(value, ['currency']),
    basisRaw: readString(value, ['basisRaw', 'basis_raw']),
    qualitativeDirection: readString(value, ['qualitativeDirection', 'qualitative_direction']),
    guidanceQuote: readString(value, ['guidanceQuote', 'guidance_quote']),
    quoteLocator: readString(value, ['quoteLocator', 'quote_locator']),
    sourceDocumentType: readString(value, ['sourceDocumentType', 'source_document_type']),
    sourceTitle: readString(value, ['sourceTitle', 'source_title']),
    sourceDocumentUrl: readString(value, ['sourceDocumentUrl', 'source_document_url']),
    relatedFilingAccession: readString(value, ['relatedFilingAccession', 'related_filing_accession']),
    relatedFilingForm: readString(value, ['relatedFilingForm', 'related_filing_form']),
    relatedFilingUrl: readString(value, ['relatedFilingUrl', 'related_filing_url']),
    source: readString(value, ['source']),
    primarySource: readString(value, ['primarySource', 'primary_source']),
    sourceMetadata: value.sourceMetadata ?? value.source_metadata ?? {},
    dataQualityFlags: value.dataQualityFlags ?? value.data_quality_flags ?? {},
    extractionConfidence: readString(value, ['extractionConfidence', 'extraction_confidence']),
    knownAt: readString(value, ['knownAt', 'known_at']),
    ingestedAt: readString(value, ['ingestedAt', 'ingested_at']),
    methodologyVersion: readString(value, ['methodologyVersion', 'methodology_version']),
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

function stringList(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).join(', ')
}

function formatJson(value: unknown): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value as Record<string, unknown>).length === 0) return '-'
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function errorMessage(error: unknown): string {
  const record = asRecord(error)
  return readString(record, ['message', 'error', 'detail']) ?? (error instanceof Error ? error.message : 'Unknown error.')
}
