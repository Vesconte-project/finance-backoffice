'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { requestClientJson } from '@/lib/client-json'
import { asRecord, firstList, type RowRecord } from '@/lib/payload'

type Props = { adminActor: string }
type CapitalEvent = {
  eventId: string
  symbol: string | null
  eventFamily: string | null
  eventType: string | null
  eventSubtype: string | null
  eventStatus: string | null
  sourceDocumentType: string | null
  sourceTitle: string | null
  sourceDocumentUrl: string | null
  relatedFilingAccession: string | null
  relatedFilingForm: string | null
  relatedFilingUrl: string | null
  announcementDate: string | null
  filingDate: string | null
  acceptedAt: string | null
  effectiveDate: string | null
  periodStart: string | null
  periodEnd: string | null
  programExpirationDate: string | null
  amountAuthorized: number | null
  amountAnnounced: number | null
  amountExecuted: number | null
  shareCountAuthorized: number | null
  shareCountAnnounced: number | null
  shareCountExecuted: number | null
  averagePrice: number | null
  currency: string | null
  counterpartyOrAgent: string | null
  programName: string | null
  securityType: string | null
  quoteSnippet: string | null
  evidenceLocator: string | null
  source: string | null
  primarySource: string | null
  sourceMetadata: unknown
  dataQualityFlags: unknown
  extractionConfidence: string | null
  knownAt: string | null
  ingestedAt: string | null
  methodologyVersion: string | null
}
type CapitalResponse = { available: boolean | null; reason: string | null; symbol: string | null; count: number; rows: CapitalEvent[] }

export function EquityCapitalEventsWorkspace({ adminActor }: Props) {
  const [symbol, setSymbol] = useState('ASML')
  const [eventType, setEventType] = useState('')
  const [sourceDocumentType, setSourceDocumentType] = useState('')
  const [asOf, setAsOf] = useState('')
  const [latestOnly, setLatestOnly] = useState(true)
  const [limit, setLimit] = useState('100')
  const [payload, setPayload] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const response = useMemo(() => normalizeResponse(payload), [payload])

  async function loadEvents(nextSymbol = symbol, nextEventType = eventType, nextDocumentType = sourceDocumentType, nextAsOf = asOf, nextLatestOnly = latestOnly, nextLimit = limit) {
    const normalizedSymbol = nextSymbol.trim().toUpperCase()
    if (!normalizedSymbol) { setPayload(null); setError('Enter a symbol.'); return }
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ symbol: normalizedSymbol, latestOnly: String(nextLatestOnly), limit: String(normalizeLimit(nextLimit)) })
    if (nextEventType.trim()) params.set('eventType', nextEventType.trim())
    if (nextDocumentType.trim()) params.set('sourceDocumentType', nextDocumentType.trim())
    if (nextAsOf) params.set('asOf', nextAsOf)
    try { setPayload(await requestClientJson(`/api/equity-capital-events?${params.toString()}`)) }
    catch (requestError) { setPayload(null); setError(errorMessage(requestError)) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadEvents('ASML', '', '', '', true, '100'), 0)
    return () => window.clearTimeout(timer)
    // The initial view loads the current canonical candidate for audit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void loadEvents() }

  return <div className="page-stack">
    <section className="card">
      <div className="split-row"><div><p className="eyebrow">Analyst workspace</p><h1>Equity Capital Events</h1><p className="small">Temporal PIT canonical candidates. Known at is the observation date, not confirmation of a capital event.</p></div><div className="small">Admin: {adminActor}</div></div>
      <form className="entity-layer-query" onSubmit={submit}>
        <div><label htmlFor="capital-symbol">Symbol</label><input id="capital-symbol" onChange={(event) => setSymbol(event.target.value)} value={symbol} /></div>
        <div><label htmlFor="capital-type">Event type</label><input id="capital-type" onChange={(event) => setEventType(event.target.value)} placeholder="shelf_registration" value={eventType} /></div>
        <div><label htmlFor="capital-document">Source document type</label><input id="capital-document" onChange={(event) => setSourceDocumentType(event.target.value)} placeholder="sec_filing_candidate" value={sourceDocumentType} /></div>
        <div><label htmlFor="capital-as-of">As of</label><input id="capital-as-of" onChange={(event) => setAsOf(event.target.value)} type="date" value={asOf} /></div>
        <div><label htmlFor="capital-limit">Limit</label><input id="capital-limit" max="500" min="1" onChange={(event) => setLimit(event.target.value)} type="number" value={limit} /></div>
        <label className="entity-layer-query-action"><input checked={latestOnly} onChange={(event) => setLatestOnly(event.target.checked)} type="checkbox" />Latest snapshot per event</label>
        <div className="entity-layer-query-action"><button className="primary" disabled={loading} type="submit">{loading ? 'Loading' : 'Load'}</button></div>
      </form>
    </section>

    <section className="card">
      <div className="split-row"><div><h2>Canonical equity capital candidates</h2><p className="small">{response.symbol ?? symbol.trim().toUpperCase()} {loading ? 'loading' : `${response.count} rows`}</p></div><Availability available={response.available} /></div>
      {error ? <div className="error">Equity capital events request failed: {error}</div> : null}
      {!loading && !error && response.available === false ? <div className="small">{response.reason ?? 'Equity-capital read model is unavailable.'}</div> : null}
      <div className="table-wrap"><table className="registry-table"><thead><tr><th>Event</th><th>Dates</th><th>Financial fields</th><th>Source document</th><th>Related filing</th><th>Evidence</th><th>Confidence</th><th>Source / known at</th><th>Audit</th></tr></thead><tbody>
        {loading ? <EmptyRow message="Loading equity capital events..." /> : null}
        {!loading && !error && response.rows.length === 0 ? <EmptyRow message={response.available === false ? 'Equity-capital read model is unavailable.' : response.reason ?? 'Sem equity capital events canonical para este filtro.'} /> : null}
        {!loading && !error ? response.rows.map((row) => <tr key={row.eventId}>
          <td><strong>{row.eventType ?? '-'}</strong><div className="small">{row.eventFamily ?? '-'} / {row.eventSubtype ?? '-'}</div><div className="small">status: {row.eventStatus ?? '-'}</div><CandidateBadges flags={row.dataQualityFlags} /></td>
          <td className="small">announced: {row.announcementDate ?? '-'}<div>filed: {row.filingDate ?? '-'}</div><div>accepted: {row.acceptedAt ?? '-'}</div><div>effective: {row.effectiveDate ?? '-'}</div></td>
          <td className="small"><Field label="Authorized" value={formatMoney(row.amountAuthorized, row.currency)} /><Field label="Announced" value={formatMoney(row.amountAnnounced, row.currency)} /><Field label="Executed" value={formatMoney(row.amountExecuted, row.currency)} /><Field label="Shares" value={formatNumber(row.shareCountAuthorized ?? row.shareCountAnnounced ?? row.shareCountExecuted)} /><Field label="Avg. price" value={formatMoney(row.averagePrice, row.currency)} /></td>
          <td className="small">{row.sourceDocumentType ?? '-'}<div>{row.sourceTitle ?? '-'}</div>{row.sourceDocumentUrl ? <ExternalLink href={row.sourceDocumentUrl} label="Open source" /> : null}</td>
          <td className="small">{row.relatedFilingForm ?? '-'} {row.relatedFilingAccession ?? ''}{row.relatedFilingUrl ? <div><ExternalLink href={row.relatedFilingUrl} label="Open filing" /></div> : null}</td>
          <td className="small"><strong>{row.quoteSnippet ?? '-'}</strong><div>locator: {row.evidenceLocator ?? '-'}</div></td>
          <td><span className={`badge ${row.extractionConfidence === 'low' ? 'failed' : 'muted'}`}>{row.extractionConfidence ?? 'unknown'}</span></td>
          <td className="small">{row.source ?? '-'}<div>primary: {row.primarySource ?? '-'}</div><div>known: {row.knownAt ?? '-'}</div><div>ingested: {row.ingestedAt ?? '-'}</div></td>
          <td className="small"><AuditDetails metadata={row.sourceMetadata} flags={row.dataQualityFlags} methodology={row.methodologyVersion} /></td>
        </tr>) : null}
      </tbody></table></div>
    </section>
  </div>
}

function Field({ label, value }: { label: string; value: string }) { return <div>{label}: {value}</div> }
function EmptyRow({ message }: { message: string }) { return <tr><td className="small" colSpan={9}>{message}</td></tr> }
function Availability({ available }: { available: boolean | null }) { return <span className={`badge ${available === true ? 'completed' : available === false ? 'failed' : 'muted'}`}>{available === true ? 'available' : available === false ? 'unavailable' : 'not loaded'}</span> }
function ExternalLink({ href, label }: { href: string; label: string }) { return <a href={href} rel="noreferrer" target="_blank">{label}</a> }

function CandidateBadges({ flags }: { flags: unknown }) {
  const record = asRecord(flags)
  if (record?.equityCapitalCandidate !== true && record?.confirmed !== false) return null
  return <div>{record?.equityCapitalCandidate === true ? <span className="badge muted">candidate</span> : null}{record?.confirmed === false ? <span className="badge failed">unconfirmed</span> : null}</div>
}

function AuditDetails({ metadata, flags, methodology }: { metadata: unknown; flags: unknown; methodology: string | null }) {
  const record = asRecord(metadata)
  const sources = listText(record?.contributingSources ?? record?.contributing_sources)
  const provenance = asRecord(record?.fieldProvenance ?? record?.field_provenance)
  const observations = record?.providerObservations ?? record?.provider_observations
  return <details><summary>{methodology ?? '-'}; sources: {sources || '-'}</summary><div>fieldProvenance: {formatJson(provenance)}</div><div>contributingSources: {sources || '-'}</div><div>providerObservations: {formatJson(observations)}</div><div>dataQualityFlags: {formatJson(flags)}</div></details>
}

function normalizeResponse(payload: unknown): CapitalResponse {
  const record = asRecord(payload)
  const rows = firstList<RowRecord>(payload, ['rows']).map(normalizeRow)
  return { available: typeof record?.available === 'boolean' ? record.available : null, reason: stringValue(record?.reason), symbol: stringValue(record?.symbol), count: numberValue(record?.count) ?? rows.length, rows }
}

function normalizeRow(row: RowRecord): CapitalEvent {
  return {
    eventId: stringValue(row.eventId ?? row.event_id) ?? '', symbol: stringValue(row.symbol), eventFamily: stringValue(row.eventFamily ?? row.event_family), eventType: stringValue(row.eventType ?? row.event_type), eventSubtype: stringValue(row.eventSubtype ?? row.event_subtype), eventStatus: stringValue(row.eventStatus ?? row.event_status), sourceDocumentType: stringValue(row.sourceDocumentType ?? row.source_document_type), sourceTitle: stringValue(row.sourceTitle ?? row.source_title), sourceDocumentUrl: stringValue(row.sourceDocumentUrl ?? row.source_document_url), relatedFilingAccession: stringValue(row.relatedFilingAccession ?? row.related_filing_accession), relatedFilingForm: stringValue(row.relatedFilingForm ?? row.related_filing_form), relatedFilingUrl: stringValue(row.relatedFilingUrl ?? row.related_filing_url), announcementDate: stringValue(row.announcementDate ?? row.announcement_date), filingDate: stringValue(row.filingDate ?? row.filing_date), acceptedAt: stringValue(row.acceptedAt ?? row.accepted_at), effectiveDate: stringValue(row.effectiveDate ?? row.effective_date), periodStart: stringValue(row.periodStart ?? row.period_start), periodEnd: stringValue(row.periodEnd ?? row.period_end), programExpirationDate: stringValue(row.programExpirationDate ?? row.program_expiration_date), amountAuthorized: numberValue(row.amountAuthorized ?? row.amount_authorized), amountAnnounced: numberValue(row.amountAnnounced ?? row.amount_announced), amountExecuted: numberValue(row.amountExecuted ?? row.amount_executed), shareCountAuthorized: numberValue(row.shareCountAuthorized ?? row.share_count_authorized), shareCountAnnounced: numberValue(row.shareCountAnnounced ?? row.share_count_announced), shareCountExecuted: numberValue(row.shareCountExecuted ?? row.share_count_executed), averagePrice: numberValue(row.averagePrice ?? row.average_price), currency: stringValue(row.currency), counterpartyOrAgent: stringValue(row.counterpartyOrAgent ?? row.counterparty_or_agent), programName: stringValue(row.programName ?? row.program_name), securityType: stringValue(row.securityType ?? row.security_type), quoteSnippet: stringValue(row.quoteSnippet ?? row.quote_snippet), evidenceLocator: stringValue(row.evidenceLocator ?? row.evidence_locator), source: stringValue(row.source), primarySource: stringValue(row.primarySource ?? row.primary_source), sourceMetadata: row.sourceMetadata ?? row.source_metadata ?? {}, dataQualityFlags: row.dataQualityFlags ?? row.data_quality_flags ?? {}, extractionConfidence: stringValue(row.extractionConfidence ?? row.extraction_confidence), knownAt: stringValue(row.knownAt ?? row.known_at), ingestedAt: stringValue(row.ingestedAt ?? row.ingested_at), methodologyVersion: stringValue(row.methodologyVersion ?? row.methodology_version),
  }
}

function normalizeLimit(value: string): number { const parsed = Number.parseInt(value, 10); return Number.isFinite(parsed) ? Math.max(1, Math.min(500, parsed)) : 100 }
function stringValue(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null }
function numberValue(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : typeof value === 'string' && value.trim() && Number.isFinite(Number(value)) ? Number(value) : null }
function listText(value: unknown): string { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).join(', ') : '' }
function formatNumber(value: number | null): string { return value === null ? '-' : new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(value) }
function formatMoney(value: number | null, currency: string | null): string { return value === null ? '-' : `${formatNumber(value)}${currency ? ` ${currency}` : ''}` }
function formatJson(value: unknown): string { if (value === null || value === undefined) return '-'; if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value as Record<string, unknown>).length === 0) return '-'; return typeof value === 'string' ? value : JSON.stringify(value) }
function errorMessage(error: unknown): string { const record = asRecord(error); return stringValue(record?.message) ?? stringValue(record?.error) ?? stringValue(record?.detail) ?? (error instanceof Error ? error.message : 'Unknown error.') }
