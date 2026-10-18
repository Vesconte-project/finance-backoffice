'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { requestClientJson } from '@/lib/client-json'
import { asRecord, firstList, type RowRecord } from '@/lib/payload'

type Props = { adminActor: string }

type InvestorEventRow = {
  eventId: string
  symbol: string | null
  eventType: string | null
  title: string | null
  description: string | null
  startsAt: string | null
  endsAt: string | null
  timezone: string | null
  status: string | null
  webcastUrl: string | null
  presentationUrls: string[]
  attachmentUrls: string[]
  relatedPressReleaseUrls: string[]
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

type InvestorEventsResponse = {
  available: boolean | null
  reason: string | null
  symbol: string | null
  count: number
  rows: InvestorEventRow[]
}

export function InvestorEventsWorkspace({ adminActor }: Props) {
  const [symbol, setSymbol] = useState('AAPL')
  const [eventType, setEventType] = useState('')
  const [asOf, setAsOf] = useState('')
  const [latestOnly, setLatestOnly] = useState(true)
  const [limit, setLimit] = useState('100')
  const [payload, setPayload] = useState<unknown | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const response = useMemo(() => normalizeResponse(payload), [payload])

  async function loadEvents(
    nextSymbol = symbol,
    nextEventType = eventType,
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
    if (nextEventType) params.set('eventType', nextEventType)
    if (nextAsOf) params.set('asOf', nextAsOf)
    try {
      setPayload(await requestClientJson(`/api/investor-events?${params.toString()}`))
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

  useEffect(() => {
    const timer = window.setTimeout(() => void loadEvents('AAPL', '', '', true, '100'), 0)
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
            <h1>Investor Events</h1>
            <p className="small">Temporal PIT canonical candidates. Known at is the observation date, not confirmation of an event.</p>
          </div>
          <div className="small">Admin: {adminActor}</div>
        </div>

        <form className="entity-layer-query" onSubmit={submit}>
          <div>
            <label htmlFor="investor-events-symbol">Symbol</label>
            <input id="investor-events-symbol" onChange={(event) => setSymbol(event.target.value)} value={symbol} />
          </div>
          <div>
            <label htmlFor="investor-events-type">Event type</label>
            <select id="investor-events-type" onChange={(event) => setEventType(event.target.value)} value={eventType}>
              <option value="">All event types</option>
              <option value="shareholder_meeting_candidate">Shareholder meeting candidate</option>
              <option value="investor_material_candidate">Investor material candidate</option>
            </select>
          </div>
          <div>
            <label htmlFor="investor-events-as-of">As of</label>
            <input id="investor-events-as-of" onChange={(event) => setAsOf(event.target.value)} type="date" value={asOf} />
          </div>
          <div>
            <label htmlFor="investor-events-limit">Limit</label>
            <input id="investor-events-limit" max="500" min="1" onChange={(event) => setLimit(event.target.value)} type="number" value={limit} />
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
            <h2>Canonical investor-event candidates</h2>
            <p className="small">{response.symbol ?? symbol.trim().toUpperCase()} {loading ? 'loading' : `${response.count} rows`}</p>
          </div>
          <AvailabilityBadge available={response.available} />
        </div>
        {error ? <div className="error">Investor events request failed: {error}</div> : null}
        {!loading && !error && response.available === false ? <div className="small">{response.reason ?? 'Investor events read model is unavailable.'}</div> : null}
        <div className="table-wrap">
          <table className="registry-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Schedule</th>
                <th>Description</th>
                <th>Links</th>
                <th>Related filing</th>
                <th>Confidence</th>
                <th>Source</th>
                <th>Known at</th>
                <th>Provenance</th>
                <th>Flags / methodology</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <EmptyRow message="Loading canonical investor events..." /> : null}
              {!loading && !error && response.rows.length === 0 ? <EmptyRow message={response.available === false ? 'Investor events read model is unavailable.' : response.reason ?? 'Sem investor-event candidates canonical para este filtro.'} /> : null}
              {!loading && !error ? response.rows.map((row) => (
                <tr key={row.eventId}>
                  <td>
                    <strong>{row.title ?? '-'}</strong>
                    <div className="small">{row.eventType ?? '-'}</div>
                    <CandidateBadges flags={row.dataQualityFlags} />
                    <div className="small">{row.eventId}</div>
                  </td>
                  <td className="small">
                    start: {row.startsAt ?? '-'}
                    <div>end: {row.endsAt ?? '-'}</div>
                    <div>timezone: {row.timezone ?? '-'}</div>
                    <div>status: {row.status ?? '-'}</div>
                  </td>
                  <td className="small">{row.description ?? '-'}</td>
                  <td className="small">
                    {row.webcastUrl ? <ExternalLink href={row.webcastUrl} label="Webcast" /> : null}
                    <ExternalLinks label="Presentations" links={row.presentationUrls} />
                    <ExternalLinks label="Attachments" links={row.attachmentUrls} />
                    <ExternalLinks label="Press releases" links={row.relatedPressReleaseUrls} />
                  </td>
                  <td className="small">
                    {row.relatedFilingForm ?? '-'} {row.relatedFilingAccession ? `/${row.relatedFilingAccession}` : ''}
                    <div>{row.relatedFilingUrl ? <ExternalLink href={row.relatedFilingUrl} label="Open filing" /> : null}</div>
                  </td>
                  <td><span className="badge muted">{row.extractionConfidence ?? 'unknown'}</span></td>
                  <td className="small">{row.source ?? '-'}<div>primary: {row.primarySource ?? '-'}</div></td>
                  <td className="small">{row.knownAt ?? '-'}<div>ingested: {row.ingestedAt ?? '-'}</div></td>
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
  if (record?.candidate !== true && record?.confirmed !== false) return null
  return (
    <div>
      {record?.candidate === true ? <span className="badge muted">candidate</span> : null}
      {record?.confirmed === false ? <span className="badge failed">unconfirmed</span> : null}
    </div>
  )
}

function ExternalLink({ href, label }: { href: string, label: string }) {
  return <a href={href} rel="noreferrer" target="_blank">{label}</a>
}

function ExternalLinks({ label, links }: { label: string, links: string[] }) {
  if (links.length === 0) return null
  return (
    <details>
      <summary>{label} ({links.length})</summary>
      {links.map((href, index) => <div key={href}><ExternalLink href={href} label={`${label} ${index + 1}`} /></div>)}
    </details>
  )
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

function normalizeResponse(payload: unknown): InvestorEventsResponse {
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

function normalizeRow(value: RowRecord): InvestorEventRow {
  return {
    eventId: readString(value, ['eventId', 'event_id']) ?? '',
    symbol: readString(value, ['symbol']),
    eventType: readString(value, ['eventType', 'event_type']),
    title: readString(value, ['title']),
    description: readString(value, ['description']),
    startsAt: readString(value, ['startsAt', 'starts_at']),
    endsAt: readString(value, ['endsAt', 'ends_at']),
    timezone: readString(value, ['timezone']),
    status: readString(value, ['status']),
    webcastUrl: readString(value, ['webcastUrl', 'webcast_url']),
    presentationUrls: readStringList(value.presentationUrls ?? value.presentation_urls),
    attachmentUrls: readStringList(value.attachmentUrls ?? value.attachment_urls),
    relatedPressReleaseUrls: readStringList(value.relatedPressReleaseUrls ?? value.related_press_release_urls),
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

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function stringList(value: unknown): string {
  return readStringList(value).join(', ')
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
