'use client'

import { useEffect, useMemo, useState } from 'react'
import { requestClientJson } from '@/lib/client-json'
import { asRecord, firstList, type RowRecord } from '@/lib/payload'

type Props = { adminActor: string }
type Tab = 'coverage' | 'calendar' | 'disclosures' | 'domains' | 'sources'
type DomainSnapshot = { state: string; coverageClass: string; recordCount: number; latestKnownAt: string | null; sources: string[] }
type CoverageRow = { symbol: string; readinessState: string | null; coreStatus: string; missingCoreDomains: string[]; unavailableCoreDomains: string[]; observedDomains: number; domains: Record<string, DomainSnapshot> }
type SourceRow = { domain: string; source: string; role: string; recordCount: number; symbolCount: number; lowConfidenceRecords: number; latestKnownAt: string | null; latestIngestedAt: string | null; coverageClass: string }
type BuildRecord = { id: number | null; status: string; startedAt: string | null; endedAt: string | null; rowCount: number; error: string | null }
type DomainRow = { domain: string; table: string; available: boolean; state: string; reason: string | null; rowCount: number; latestObservationKnownAt: string | null; latestObservationIngestedAt: string | null; sources: string[]; buildTelemetryAvailable: boolean | null; buildTelemetryReason: string | null; latestBuild: BuildRecord | null; latestFailedBuild: BuildRecord | null; freshnessStatus: string }
type SemanticEventRow = { domain: string; eventId: string; symbol: string | null; eventType: string; title: string; classification: string; occursAt: string | null; occursAtRole: string; knownAt: string | null; source: string | null; primarySource: string | null; confidence: string | null; documentType: string | null; documentUrl: string | null; quote: string | null; sourceMetadata: unknown; dataQualityFlags: unknown }
type SemanticInventory = { available: boolean | null; reason: string | null; snapshotMode: string; isPointInTime: boolean; unavailableDomains: string[]; rows: SemanticEventRow[] }
const COVERAGE_PAGE_SIZE = 250

const DOMAINS = [
  ['financialStatements', 'Statements'], ['marketMetrics', 'Metrics'], ['earningsEvents', 'Earnings'],
  ['filings', 'Filings'], ['corporateActions', 'Actions'], ['investorEvents', 'Investor events'], ['guidance', 'Guidance'], ['equityCapitalEvents', 'Capital events'], ['fundDistributions', 'Fund distributions'],
] as const

export function DataControlWorkspace({ adminActor }: Props) {
  const [tab, setTab] = useState<Tab>('coverage')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [coveragePayload, setCoveragePayload] = useState<unknown>(null)
  const [sourcesPayload, setSourcesPayload] = useState<unknown>(null)
  const [domainsPayload, setDomainsPayload] = useState<unknown>(null)
  const [calendarPayload, setCalendarPayload] = useState<unknown>(null)
  const [disclosuresPayload, setDisclosuresPayload] = useState<unknown>(null)
  const [semanticSymbol, setSemanticSymbol] = useState('')
  const [calendarStartDate, setCalendarStartDate] = useState('')
  const [calendarEndDate, setCalendarEndDate] = useState('')
  const [semanticAsOf, setSemanticAsOf] = useState('')
  const [latestOnly, setLatestOnly] = useState(true)
  const [semanticLimit, setSemanticLimit] = useState('200')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const coverage = useMemo(() => normalizeCoverage(coveragePayload), [coveragePayload])
  const sources = useMemo(() => normalizeSources(sourcesPayload), [sourcesPayload])
  const domains = useMemo(() => normalizeDomains(domainsPayload), [domainsPayload])
  const calendar = useMemo(() => normalizeSemanticInventory(calendarPayload), [calendarPayload])
  const disclosures = useMemo(() => normalizeSemanticInventory(disclosuresPayload), [disclosuresPayload])

  async function loadCoverage(nextSearch = search, nextOffset = offset) {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ limit: String(COVERAGE_PAGE_SIZE), offset: String(nextOffset) })
    if (nextSearch.trim()) params.set('search', nextSearch.trim().toUpperCase())
    try {
      setCoveragePayload(await requestClientJson(`/api/data-control/coverage?${params.toString()}`))
    } catch (requestError) {
      setError(message(requestError))
    } finally {
      setLoading(false)
    }
  }

  async function loadSources() {
    setLoading(true)
    setError(null)
    try {
      setSourcesPayload(await requestClientJson('/api/data-control/sources?limit=500'))
    } catch (requestError) {
      setError(message(requestError))
    } finally {
      setLoading(false)
    }
  }

  async function loadDomains() {
    setLoading(true)
    setError(null)
    try {
      setDomainsPayload(await requestClientJson('/api/data-control/domains'))
    } catch (requestError) {
      setError(message(requestError))
    } finally {
      setLoading(false)
    }
  }

  async function loadSemantic(view: 'calendar' | 'disclosures') {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ limit: semanticLimit, latestOnly: String(latestOnly) })
    if (semanticSymbol.trim()) params.set('symbol', semanticSymbol.trim().toUpperCase())
    if (semanticAsOf) params.set('asOf', semanticAsOf)
    if (view === 'calendar') {
      if (calendarStartDate) params.set('startDate', calendarStartDate)
      if (calendarEndDate) params.set('endDate', calendarEndDate)
    }
    try {
      const payload = await requestClientJson(`/api/data-control/${view}?${params.toString()}`)
      if (view === 'calendar') setCalendarPayload(payload)
      else setDisclosuresPayload(payload)
    } catch (requestError) {
      setError(message(requestError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCoverage(''), 0)
    return () => window.clearTimeout(timer)
    // The initial view is the global coverage matrix.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function switchTab(nextTab: Tab) {
    setTab(nextTab)
    if (nextTab === 'domains' && domainsPayload === null) void loadDomains()
    if (nextTab === 'sources' && sourcesPayload === null) void loadSources()
    if (nextTab === 'calendar' && calendarPayload === null) void loadSemantic('calendar')
    if (nextTab === 'disclosures' && disclosuresPayload === null) void loadSemantic('disclosures')
  }

  return (
    <div className="page-stack">
      <section className="card">
        <div className="split-row">
          <div>
            <p className="eyebrow">Data operations</p>
            <h1>Data Control</h1>
            <p className="small">Coverage, operational events, disclosures, pipelines, and source lineage for canonical read models.</p>
          </div>
          <div className="small">Admin: {adminActor}</div>
        </div>
        <div className="entity-layer-query-action">
          <button className={tab === 'coverage' ? 'primary' : 'secondary'} onClick={() => switchTab('coverage')} type="button">Coverage</button>
          <button className={tab === 'calendar' ? 'primary' : 'secondary'} onClick={() => switchTab('calendar')} type="button">Calendar</button>
          <button className={tab === 'disclosures' ? 'primary' : 'secondary'} onClick={() => switchTab('disclosures')} type="button">Disclosures</button>
          <button className={tab === 'domains' ? 'primary' : 'secondary'} onClick={() => switchTab('domains')} type="button">Pipelines</button>
          <button className={tab === 'sources' ? 'primary' : 'secondary'} onClick={() => switchTab('sources')} type="button">Source health</button>
        </div>
      </section>

      {error ? <section className="card"><div className="error">Data control request failed: {error}</div></section> : null}
      {tab === 'coverage' ? (
        <CoverageView coverage={coverage} loading={loading} offset={offset} search={search} onSearch={setSearch} onLoad={() => { setOffset(0); void loadCoverage(search, 0) }} onPage={(nextOffset) => { setOffset(nextOffset); void loadCoverage(search, nextOffset) }} />
      ) : null}
      {tab === 'domains' ? <DomainsView domains={domains} loading={loading} /> : null}
      {tab === 'sources' ? <SourcesView sources={sources} loading={loading} /> : null}
      {tab === 'calendar' ? <SemanticView mode="calendar" inventory={calendar} loading={loading} symbol={semanticSymbol} startDate={calendarStartDate} endDate={calendarEndDate} asOf={semanticAsOf} latestOnly={latestOnly} limit={semanticLimit} onSymbol={setSemanticSymbol} onStartDate={setCalendarStartDate} onEndDate={setCalendarEndDate} onAsOf={setSemanticAsOf} onLatestOnly={setLatestOnly} onLimit={setSemanticLimit} onLoad={() => void loadSemantic('calendar')} /> : null}
      {tab === 'disclosures' ? <SemanticView mode="disclosures" inventory={disclosures} loading={loading} symbol={semanticSymbol} startDate="" endDate="" asOf={semanticAsOf} latestOnly={latestOnly} limit={semanticLimit} onSymbol={setSemanticSymbol} onStartDate={setCalendarStartDate} onEndDate={setCalendarEndDate} onAsOf={setSemanticAsOf} onLatestOnly={setLatestOnly} onLimit={setSemanticLimit} onLoad={() => void loadSemantic('disclosures')} /> : null}
    </div>
  )
}

function CoverageView({ coverage, loading, offset, search, onSearch, onLoad, onPage }: { coverage: Coverage; loading: boolean; offset: number; search: string; onSearch: (value: string) => void; onLoad: () => void; onPage: (offset: number) => void }) {
  return <section className="card">
    <div className="split-row"><div><h2>Tracked universe coverage</h2><p className="small">Required domains: statements, market metrics and earnings. Events are observational, not missing-data failures.</p></div><Availability available={coverage.available} /></div>
    <div className="metric-grid">
      <Metric label="Tracked" value={String(coverage.summary.trackedTickers ?? 0)} />
      <Metric label="Core healthy" value={String(coverage.summary.coreHealthy ?? 0)} />
      <Metric label="Core missing" value={String(coverage.summary.coreMissing ?? 0)} />
      <Metric label="Core unavailable" value={String(coverage.summary.coreUnavailable ?? 0)} />
    </div>
    <div className="data-filter-bar"><div><label htmlFor="data-control-search">Ticker</label><input id="data-control-search" onChange={(event) => onSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onLoad() }} placeholder="Filter tracked universe" value={search} /></div><div className="entity-layer-query-action"><button className="primary" disabled={loading} onClick={onLoad} type="button">{loading ? 'Loading' : 'Apply'}</button></div></div>
    {coverage.available === false ? <div className="small">{coverage.reason ?? 'Coverage read model unavailable.'}</div> : null}
    <div className="table-wrap"><table className="registry-table"><thead><tr><th>Ticker</th><th>Core</th>{DOMAINS.map(([, label]) => <th key={label}>{label}</th>)}</tr></thead><tbody>
      {loading ? <EmptyRow cols={DOMAINS.length + 2} message="Loading tracked-universe coverage..." /> : null}
      {!loading && coverage.rows.length === 0 ? <EmptyRow cols={DOMAINS.length + 2} message="No tracked tickers match this filter." /> : null}
      {!loading ? coverage.rows.map((row) => <tr key={row.symbol}><td><strong>{row.symbol}</strong><div className="small">{row.readinessState ?? '-'}</div></td><td><span className={`badge ${badgeClass(row.coreStatus)}`}>{row.coreStatus}</span><div className="small">{[...row.unavailableCoreDomains, ...row.missingCoreDomains].join(', ') || 'complete'}</div></td>{DOMAINS.map(([key]) => <DomainCell key={key} snapshot={row.domains[key]} />)}</tr>) : null}
    </tbody></table></div>
    {coverage.available && coverage.total > COVERAGE_PAGE_SIZE ? <div className="split-row"><span className="small">{offset + 1}-{Math.min(offset + coverage.rows.length, coverage.total)} of {coverage.total} tracked tickers</span><div className="entity-layer-query-action"><button className="secondary" disabled={loading || offset === 0} onClick={() => onPage(Math.max(0, offset - COVERAGE_PAGE_SIZE))} type="button">Previous</button><button className="secondary" disabled={loading || offset + COVERAGE_PAGE_SIZE >= coverage.total} onClick={() => onPage(offset + COVERAGE_PAGE_SIZE)} type="button">Next</button></div></div> : null}
  </section>
}

function SourcesView({ sources, loading }: { sources: Sources; loading: boolean }) {
  return <section className="card"><div className="split-row"><div><h2>Source lineage</h2><p className="small">Primary sources are canonical table columns; contributing sources are observed provenance, not provider availability claims.</p></div><Availability available={sources.available} /></div>
    {sources.available === false ? <div className="small">{sources.reason ?? 'Source-health read model unavailable.'}</div> : null}
    <div className="table-wrap"><table className="registry-table"><thead><tr><th>Domain</th><th>Source</th><th>Role</th><th>Tickers</th><th>Records</th><th>Low confidence</th><th>Latest known</th><th>Latest ingested</th></tr></thead><tbody>
      {loading ? <EmptyRow cols={8} message="Loading canonical source health..." /> : null}
      {!loading && sources.rows.length === 0 ? <EmptyRow cols={8} message="No source-health rows returned." /> : null}
      {!loading ? sources.rows.map((row) => <tr key={`${row.domain}-${row.source}-${row.role}`}><td>{row.domain}</td><td><strong>{row.source}</strong></td><td><span className="badge muted">{row.role}</span></td><td>{row.symbolCount}</td><td>{row.recordCount}</td><td>{row.lowConfidenceRecords || '-'}</td><td>{row.latestKnownAt ?? '-'}</td><td>{row.latestIngestedAt ?? '-'}</td></tr>) : null}
    </tbody></table></div>
  </section>
}

function SemanticView({ mode, inventory, loading, symbol, startDate, endDate, asOf, latestOnly, limit, onSymbol, onStartDate, onEndDate, onAsOf, onLatestOnly, onLimit, onLoad }: { mode: 'calendar' | 'disclosures'; inventory: SemanticInventory; loading: boolean; symbol: string; startDate: string; endDate: string; asOf: string; latestOnly: boolean; limit: string; onSymbol: (value: string) => void; onStartDate: (value: string) => void; onEndDate: (value: string) => void; onAsOf: (value: string) => void; onLatestOnly: (value: boolean) => void; onLimit: (value: string) => void; onLoad: () => void }) {
  const isCalendar = mode === 'calendar'
  return <section className="card"><div className="split-row"><div><h2>{isCalendar ? 'Operational calendar' : 'Disclosure monitor'}</h2><p className="small">{isCalendar ? 'Dates are event dates. knownAt remains the canonical observation date.' : 'Filings are authoritative metadata; guidance and capital records remain document-backed candidates.'}</p></div><Availability available={inventory.available} /></div>
    <div className="data-filter-bar">
      <div><label htmlFor={`${mode}-symbol`}>Symbol</label><input id={`${mode}-symbol`} onChange={(event) => onSymbol(event.target.value)} placeholder="Optional" value={symbol} /></div>
      {isCalendar ? <><div><label htmlFor="calendar-start">From</label><input id="calendar-start" onChange={(event) => onStartDate(event.target.value)} type="date" value={startDate} /></div><div><label htmlFor="calendar-end">To</label><input id="calendar-end" onChange={(event) => onEndDate(event.target.value)} type="date" value={endDate} /></div></> : null}
      <div><label htmlFor={`${mode}-asof`}>Known as of</label><input id={`${mode}-asof`} onChange={(event) => onAsOf(event.target.value)} type="date" value={asOf} /></div>
      <div><label htmlFor={`${mode}-limit`}>Limit</label><input id={`${mode}-limit`} max="500" min="1" onChange={(event) => onLimit(event.target.value || '200')} type="number" value={limit} /></div>
      <div><label htmlFor={`${mode}-latest`}>Snapshots</label><label className="small"><input checked={latestOnly} id={`${mode}-latest`} onChange={(event) => onLatestOnly(event.target.checked)} type="checkbox" /> Latest per logical event</label></div>
      <div className="entity-layer-query-action"><button className="primary" disabled={loading} onClick={onLoad} type="button">{loading ? 'Loading' : 'Apply'}</button></div>
    </div>
    <div className="small">Mode: {inventory.snapshotMode}; {inventory.isPointInTime ? 'point-in-time snapshots' : 'current operational snapshot selection'}.</div>
    {inventory.available === false ? <div className="small">{inventory.reason ?? 'Read models unavailable.'}</div> : null}
    {inventory.unavailableDomains.length ? <div className="small">Unavailable domains: {inventory.unavailableDomains.join(', ')}</div> : null}
    <div className="table-wrap"><table className="registry-table"><thead><tr><th>{isCalendar ? 'Date / event' : 'Observed / disclosure'}</th><th>Entity</th><th>Classification</th><th>Source / confidence</th><th>Known at</th><th>Evidence / provenance</th></tr></thead><tbody>
      {loading ? <EmptyRow cols={6} message={`Loading ${isCalendar ? 'calendar' : 'disclosures'}...`} /> : null}
      {!loading && inventory.rows.length === 0 ? <EmptyRow cols={6} message={inventory.reason ?? `No ${isCalendar ? 'calendar events' : 'disclosures'} match this filter.`} /> : null}
      {!loading ? inventory.rows.map((row) => <tr key={`${row.domain}-${row.eventId}`}><td><strong>{row.occursAt ?? '-'}</strong><div className="small">{row.occursAtRole}</div><div>{row.title}</div></td><td><strong>{row.symbol ?? '-'}</strong><div className="small">{row.domain}</div></td><td><span className={`badge ${row.classification === 'candidate' ? 'muted' : 'completed'}`}>{row.classification}</span><div className="small">{row.eventType}</div></td><td><strong>{row.primarySource ?? row.source ?? '-'}</strong><div className="small">{row.confidence ?? '-'}</div></td><td>{row.knownAt ?? '-'}</td><td><Evidence row={row} /></td></tr>) : null}
    </tbody></table></div>
  </section>
}

function Evidence({ row }: { row: SemanticEventRow }) { return <details><summary>{row.documentType ?? 'canonical record'}{row.documentUrl ? '; link available' : ''}</summary>{row.documentUrl ? <div><a href={row.documentUrl} rel="noreferrer" target="_blank">Open source document</a></div> : null}{row.quote ? <div className="small">{row.quote}</div> : null}<div className="small">fieldProvenance: {formatJson(asRecord(row.sourceMetadata)?.fieldProvenance ?? asRecord(row.sourceMetadata)?.field_provenance)}</div><div className="small">contributingSources: {formatJson(asRecord(row.sourceMetadata)?.contributingSources ?? asRecord(row.sourceMetadata)?.contributing_sources)}</div><div className="small">flags: {formatJson(row.dataQualityFlags)}</div></details> }

function DomainsView({ domains, loading }: { domains: Domains; loading: boolean }) {
  return <section className="card"><div className="split-row"><div><h2>Canonical pipeline inventory</h2><p className="small">A successful empty build means no safe canonical observations, not a source failure. Freshness SLAs are not configured yet.</p></div><Availability available={domains.available} /></div>
    {domains.available === false ? <div className="small">{domains.reason ?? 'Domain inventory unavailable.'}</div> : null}
    <div className="table-wrap"><table className="registry-table"><thead><tr><th>Domain / state</th><th>Canonical data</th><th>Sources</th><th>Latest build</th><th>Last failure</th></tr></thead><tbody>
      {loading ? <EmptyRow cols={5} message="Loading canonical pipeline inventory..." /> : null}
      {!loading && domains.rows.length === 0 ? <EmptyRow cols={5} message="No canonical domains returned." /> : null}
      {!loading ? domains.rows.map((row) => <tr key={row.domain}><td><strong>{row.domain}</strong><div className="small">{row.table}</div><span className={`badge ${badgeClass(row.state)}`}>{row.state}</span><div className="small">{row.reason ?? '-'}</div></td><td>{row.rowCount} rows<div className="small">known: {row.latestObservationKnownAt ?? '-'}</div><div className="small">ingested: {row.latestObservationIngestedAt ?? '-'}</div></td><td>{row.sources.join(', ') || '-'}<div className="small">telemetry: {row.buildTelemetryAvailable === true ? 'available' : row.buildTelemetryAvailable === false ? row.buildTelemetryReason ?? 'unavailable' : '-'}</div></td><td><BuildSummary build={row.latestBuild} /><div className="small">freshness: {row.freshnessStatus}</div></td><td><BuildSummary build={row.latestFailedBuild} failure /></td></tr>) : null}
    </tbody></table></div>
  </section>
}

function BuildSummary({ build, failure = false }: { build: BuildRecord | null; failure?: boolean }) { if (!build) return <span className="small">-</span>; return <><span className={`badge ${badgeClass(build.status)}`}>{build.status}</span><div className="small">#{build.id ?? '-'} · {build.rowCount} written</div><div className="small">{build.endedAt ?? build.startedAt ?? '-'}</div>{failure && build.error ? <div className="small">{build.error}</div> : null}</> }

function DomainCell({ snapshot }: { snapshot: DomainSnapshot | undefined }) {
  const state = snapshot?.state ?? 'unavailable'
  return <td><span className={`badge ${badgeClass(state)}`}>{state}</span><div className="small">{snapshot?.recordCount ?? 0} rows</div><div className="small">{snapshot?.latestKnownAt ?? '-'}</div></td>
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="compact-card"><label>{label}</label><div className="metric-value">{value}</div></div> }
function EmptyRow({ cols, message }: { cols: number; message: string }) { return <tr><td className="small" colSpan={cols}>{message}</td></tr> }
function Availability({ available }: { available: boolean | null }) { return <span className={`badge ${available === true ? 'completed' : available === false ? 'failed' : 'muted'}`}>{available === true ? 'available' : available === false ? 'unavailable' : 'not loaded'}</span> }
function badgeClass(value: string): string { return value === 'healthy' || value === 'has_observations' || value === 'success' ? 'completed' : value === 'missing' || value === 'unavailable' || value === 'read_model_unavailable' || value === 'build_failed' || value === 'failed' ? 'failed' : 'muted' }

type Coverage = { available: boolean | null; reason: string | null; total: number; summary: Record<string, unknown>; rows: CoverageRow[] }
type Sources = { available: boolean | null; reason: string | null; rows: SourceRow[] }
type Domains = { available: boolean | null; reason: string | null; rows: DomainRow[] }
function normalizeCoverage(payload: unknown): Coverage { const record = asRecord(payload); return { available: typeof record?.available === 'boolean' ? record.available : null, reason: stringValue(record?.reason), total: numberValue(record?.total) ?? 0, summary: asRecord(record?.summary) ?? {}, rows: firstList<RowRecord>(payload, ['rows']).map(normalizeCoverageRow) } }
function normalizeSources(payload: unknown): Sources { const record = asRecord(payload); return { available: typeof record?.available === 'boolean' ? record.available : null, reason: stringValue(record?.reason), rows: firstList<RowRecord>(payload, ['rows']).map((row) => ({ domain: stringValue(row.domain) ?? '-', source: stringValue(row.source) ?? '-', role: stringValue(row.role) ?? '-', recordCount: numberValue(row.recordCount) ?? 0, symbolCount: numberValue(row.symbolCount) ?? 0, lowConfidenceRecords: numberValue(row.lowConfidenceRecords) ?? 0, latestKnownAt: stringValue(row.latestKnownAt), latestIngestedAt: stringValue(row.latestIngestedAt), coverageClass: stringValue(row.coverageClass) ?? '-' })) } }
function normalizeBuild(value: unknown): BuildRecord | null { const row = asRecord(value); return row ? { id: numberValue(row.id), status: stringValue(row.status) ?? 'unknown', startedAt: stringValue(row.startedAt), endedAt: stringValue(row.endedAt), rowCount: numberValue(row.rowCount) ?? 0, error: stringValue(row.error) } : null }
function normalizeDomains(payload: unknown): Domains { const record = asRecord(payload); return { available: typeof record?.available === 'boolean' ? record.available : null, reason: stringValue(record?.reason), rows: firstList<RowRecord>(payload, ['rows']).map((row) => ({ domain: stringValue(row.domain) ?? '-', table: stringValue(row.table) ?? '-', available: row.available === true, state: stringValue(row.state) ?? 'unknown', reason: stringValue(row.reason), rowCount: numberValue(row.rowCount) ?? 0, latestObservationKnownAt: stringValue(row.latestObservationKnownAt), latestObservationIngestedAt: stringValue(row.latestObservationIngestedAt), sources: stringList(row.sources), buildTelemetryAvailable: typeof row.buildTelemetryAvailable === 'boolean' ? row.buildTelemetryAvailable : null, buildTelemetryReason: stringValue(row.buildTelemetryReason), latestBuild: normalizeBuild(row.latestBuild), latestFailedBuild: normalizeBuild(row.latestFailedBuild), freshnessStatus: stringValue(row.freshnessStatus) ?? 'not_configured' })) } }
function normalizeSemanticInventory(payload: unknown): SemanticInventory { const record = asRecord(payload); return { available: typeof record?.available === 'boolean' ? record.available : null, reason: stringValue(record?.reason), snapshotMode: stringValue(record?.snapshotMode) ?? 'latest', isPointInTime: record?.isPointInTime === true, unavailableDomains: stringList(record?.unavailableDomains), rows: firstList<RowRecord>(payload, ['rows']).map((row) => ({ domain: stringValue(row.domain) ?? '-', eventId: stringValue(row.eventId) ?? '-', symbol: stringValue(row.symbol), eventType: stringValue(row.eventType) ?? '-', title: stringValue(row.title) ?? '-', classification: stringValue(row.classification) ?? 'unknown', occursAt: stringValue(row.occursAt), occursAtRole: stringValue(row.occursAtRole) ?? '-', knownAt: stringValue(row.knownAt), source: stringValue(row.source), primarySource: stringValue(row.primarySource), confidence: stringValue(row.confidence), documentType: stringValue(row.documentType), documentUrl: stringValue(row.documentUrl), quote: stringValue(row.quote), sourceMetadata: row.sourceMetadata, dataQualityFlags: row.dataQualityFlags })) } }
function normalizeCoverageRow(row: RowRecord): CoverageRow { const domainsRecord = asRecord(row.domains) ?? {}; const domains: Record<string, DomainSnapshot> = {}; for (const [key, value] of Object.entries(domainsRecord)) { const item = asRecord(value) ?? {}; domains[key] = { state: stringValue(item.state) ?? 'unavailable', coverageClass: stringValue(item.coverageClass) ?? '-', recordCount: numberValue(item.recordCount) ?? 0, latestKnownAt: stringValue(item.latestKnownAt), sources: stringList(item.sources) } } return { symbol: stringValue(row.symbol) ?? '-', readinessState: stringValue(row.readinessState), coreStatus: stringValue(row.coreStatus) ?? 'unavailable', missingCoreDomains: stringList(row.missingCoreDomains), unavailableCoreDomains: stringList(row.unavailableCoreDomains), observedDomains: numberValue(row.observedDomains) ?? 0, domains } }
function stringValue(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null }
function numberValue(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : typeof value === 'string' && Number.isFinite(Number(value)) ? Number(value) : null }
function stringList(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [] }
function formatJson(value: unknown): string { if (value === null || value === undefined) return '-'; try { return JSON.stringify(value) } catch { return String(value) } }
function message(error: unknown): string { const record = asRecord(error); return stringValue(record?.message) ?? stringValue(record?.detail) ?? (error instanceof Error ? error.message : 'Unknown error.') }
