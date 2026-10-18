'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { requestClientJson } from '@/lib/client-json'
import { asRecord, firstList, type RowRecord } from '@/lib/payload'

type Props = {
  adminActor: string
}

type EndpointKey = 'summary' | 'dedup' | 'tail' | 'sourceHealth' | 'review'

type WorkspaceState = Record<EndpointKey, unknown | null> & {
  loading: boolean
  errors: Partial<Record<EndpointKey, string>>
}

type AvailabilityState = {
  label: string
  available: boolean | null
  detail: string
}

type CountRow = {
  label: string
  value: string
  detail?: string
}

const endpointRequests: Array<[EndpointKey, string]> = [
  ['summary', '/api/entity-layer/summary'],
  ['dedup', '/api/entity-layer/dedup?limit=20'],
  ['tail', '/api/entity-layer/tail?limit=20'],
  ['sourceHealth', '/api/entity-layer/source-health?sample_limit=10'],
  ['review', '/api/entity-layer/review'],
]

const sourceLabels = [
  'OpenFIGI',
  'listing ISIN',
  'GLEIF legal-name',
  'GLEIF ISIN->LEI',
  'GLEIF LEI->ISIN',
]

export function EntityLayerWorkspace({ adminActor }: Props) {
  const [state, setState] = useState<WorkspaceState>({
    summary: null,
    dedup: null,
    tail: null,
    sourceHealth: null,
    review: null,
    loading: true,
    errors: {},
  })
  const [entityQueryKind, setEntityQueryKind] = useState('symbol')
  const [entityQuery, setEntityQuery] = useState('SAP')
  const [entitiesPayload, setEntitiesPayload] = useState<unknown | null>(null)
  const [entitiesLoading, setEntitiesLoading] = useState(true)
  const [entitiesError, setEntitiesError] = useState<string | null>(null)

  async function loadWorkspace() {
    setState((current) => ({ ...current, loading: true, errors: {} }))
    const results = await Promise.allSettled(
      endpointRequests.map(async ([key, url]) => [key, await requestClientJson(url)] as const)
    )
    const next: WorkspaceState = {
      summary: null,
      dedup: null,
      tail: null,
      sourceHealth: null,
      review: null,
      loading: false,
      errors: {},
    }

    results.forEach((result, index) => {
      const key = endpointRequests[index][0]
      if (result.status === 'fulfilled') {
        next[key] = result.value[1]
      } else {
        next.errors[key] = errorMessage(result.reason)
      }
    })

    setState(next)
  }

  async function loadEntities(kind = entityQueryKind, query = entityQuery) {
    const trimmed = query.trim()
    if (!trimmed) {
      setEntitiesPayload(null)
      setEntitiesError('Enter a symbol, entity id, LEI, or free-text query.')
      return
    }

    setEntitiesLoading(true)
    setEntitiesError(null)
    try {
      const params = new URLSearchParams({ [kind]: trimmed })
      setEntitiesPayload(await requestClientJson(`/api/entity-layer/entities?${params.toString()}`))
    } catch (error) {
      setEntitiesPayload(null)
      setEntitiesError(errorMessage(error))
    } finally {
      setEntitiesLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadWorkspace()
      void loadEntities('symbol', 'SAP')
    }, 0)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const summary = useMemo(() => normalizeSummary(state.summary), [state.summary])
  const dedupGroups = useMemo(() => normalizeDedupGroups(state.dedup), [state.dedup])
  const tailRows = useMemo(() => normalizeTailRows(state.tail), [state.tail])
  const sourceHealth = useMemo(() => normalizeSourceHealth(state.sourceHealth), [state.sourceHealth])
  const entityRows = useMemo(() => normalizeEntityRows(entitiesPayload), [entitiesPayload])
  const reviewRows = useMemo(() => normalizeReviewRows(state.review), [state.review])
  const reviewQueueAvailable = readQueueAvailable(state.review)
  const degradedEndpoints = useMemo(() => {
    return endpointRequests
      .map(([key]) => [key, availabilityFor(state[key])] as const)
      .filter(([, availability]) => availability.available === false)
  }, [state])

  function submitEntityQuery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void loadEntities()
  }

  return (
    <div className="page-stack entity-layer-workspace">
      <div className="card">
        <div className="split-row">
          <div>
            <p className="eyebrow">Analyst workspace</p>
            <h1>Entity Layer</h1>
            <p className="small">
              Read-only diagnostics for entity identity coverage, deduplication, source cache health, and review queue state.
            </p>
          </div>
          <div className="entity-layer-header-meta">
            <div className="small">Admin: {adminActor}</div>
            <button className="secondary entity-layer-refresh" onClick={() => void loadWorkspace()} type="button">Refresh</button>
          </div>
        </div>
      </div>

      {Object.keys(state.errors).length > 0 ? <EndpointErrorPanel errors={state.errors} /> : null}
      {degradedEndpoints.length > 0 ? <DegradedPanel endpoints={degradedEndpoints} /> : null}

      <CoverageSummaryPanel loading={state.loading} summary={summary} />
      <DedupPanel groups={dedupGroups} loading={state.loading} payload={state.dedup} />
      <TailPanel loading={state.loading} rows={tailRows} tailPayload={state.tail} />
      <SourceHealthPanel loading={state.loading} rows={sourceHealth} payload={state.sourceHealth} />

      <section className="card">
        <div className="split-row">
          <div>
            <h2>Entity drill-down</h2>
            <p className="small">Query the entity layer by symbol, entity id, LEI, or free text. This panel only reads the analyst endpoint.</p>
          </div>
          <AvailabilityBadge availability={availabilityFor(entitiesPayload)} />
        </div>

        <form className="entity-layer-query" onSubmit={submitEntityQuery}>
          <div>
            <label htmlFor="entity-query-kind">Query key</label>
            <select id="entity-query-kind" onChange={(event) => setEntityQueryKind(event.target.value)} value={entityQueryKind}>
              <option value="symbol">symbol</option>
              <option value="entity">entity</option>
              <option value="lei">LEI</option>
              <option value="q">q</option>
            </select>
          </div>
          <div>
            <label htmlFor="entity-query">Value</label>
            <input id="entity-query" onChange={(event) => setEntityQuery(event.target.value)} value={entityQuery} />
          </div>
          <div className="entity-layer-query-action">
            <button className="primary" type="submit">Search</button>
          </div>
        </form>

        {entitiesError ? <div className="error">Entity query failed: {entitiesError}</div> : null}
        <EntityDrilldownTable loading={entitiesLoading} rows={entityRows} payload={entitiesPayload} />
      </section>

      <ReviewQueuePanel loading={state.loading} queueAvailable={reviewQueueAvailable} rows={reviewRows} />
    </div>
  )
}

function CoverageSummaryPanel({ loading, summary }: { loading: boolean; summary: ReturnType<typeof normalizeSummary> }) {
  return (
    <section className="card">
      <div className="split-row">
        <div>
          <h2>Coverage summary</h2>
          <p className="small">Scope, batch, attachment coverage, confidence distribution, and recent batch trend.</p>
        </div>
        <AvailabilityBadge availability={summary.availability} />
      </div>

      <div className="metric-grid entity-layer-metric-grid">
        <KpiCard label="Batch" value={loading ? '...' : summary.batchId} sub={summary.scope} />
        <KpiCard label="Entity master" value={loading ? '...' : summary.entityMasterCount} sub="master records" />
        <KpiCard label="Listings" value={loading ? '...' : summary.listingCount} sub="entity listings" />
        <KpiCard label="Resolved" value={loading ? '...' : summary.resolvedCount} sub={summary.resolvedPercent} status="completed" />
        <KpiCard label="Provisional" value={loading ? '...' : summary.provisionalCount} sub={summary.provisionalPercent} status="running" />
        <KpiCard label="Unresolved" value={loading ? '...' : summary.unresolvedCount} sub={summary.unresolvedPercent} status={summary.unresolvedCount === '0' ? 'completed' : 'failed'} />
      </div>

      <div className="entity-layer-three-column">
        <BreakdownBlock title="Attach method breakdown" rows={summary.attachMethods} />
        <BreakdownBlock title="Confidence distribution" rows={summary.confidenceDistribution} />
        <TrendBlock rows={summary.batchTrend} />
      </div>
    </section>
  )
}

function DedupPanel({ groups, loading, payload }: { groups: DedupGroup[]; loading: boolean; payload: unknown }) {
  const count = readNumber(asRecord(payload), ['count', 'total', 'group_count', 'groupCount']) ?? groups.length

  return (
    <section className="card">
      <div className="split-row">
        <div>
          <h2>Dedup results</h2>
          <p className="small">Multi-listing entities grouped by legal identity and sibling listing attachments.</p>
        </div>
        <div className="meta">
          <span className="badge muted">groups: {loading ? '...' : count}</span>
          <AvailabilityBadge availability={availabilityFor(payload)} />
        </div>
      </div>

      <div className="table-wrap">
        <table className="registry-table entity-layer-table">
          <thead>
            <tr>
              <th>Entity</th>
              <th>LEI</th>
              <th>Home</th>
              <th>Siblings</th>
              <th>Attach methods</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <EmptyRow colSpan={5} text="Loading dedup results..." /> : null}
            {!loading && groups.length === 0 ? <EmptyRow colSpan={5} text="No multi-listing entity groups returned." /> : null}
            {!loading ? groups.map((group, index) => (
              <tr key={`${group.lei}-${group.legalName}-${index}`}>
                <td>
                  <strong>{group.legalName}</strong>
                  <div className="small">{group.entityId}</div>
                </td>
                <td>{group.lei}</td>
                <td>{group.homeCountry}</td>
                <td><ListingList listings={group.listings} /></td>
                <td><BadgeList values={group.attachMethods} /></td>
              </tr>
            )) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function TailPanel({
  loading,
  rows,
  tailPayload,
}: {
  loading: boolean
  rows: TailRow[]
  tailPayload: unknown
}) {
  const unresolvedMulti = readNumberFromAny(
    [tailPayload],
    ['unresolvedMultiListingEntitiesCount', 'unresolved_multi_listing_entities_count', 'unresolved_multi_listing_count']
  )
  const tailSummary = firstRecord(asRecord(tailPayload), ['summary']) ?? asRecord(tailPayload)
  const reasonRows = normalizeBreakdown(firstValue(tailSummary, ['reasons', 'reasonBuckets', 'reason_buckets']))
  const segmentRows = normalizeBreakdown(firstValue(tailSummary, ['segments', 'segmentBuckets', 'segment_buckets']))
  const displayReasonRows = reasonRows.length > 0 ? reasonRows : bucketRows(rows, (row) => row.reason)
  const displaySegmentRows = segmentRows.length > 0 ? segmentRows : bucketRows(rows, (row) => row.segment)

  return (
    <section className="card">
      <div className="split-row">
        <div>
          <h2>Tail panel</h2>
          <p className="small">Unresolved and provisional entity attachments segmented by listing shape and reason bucket.</p>
        </div>
        <div className="meta">
          <span className={unresolvedMulti && unresolvedMulti > 0 ? 'badge failed' : 'badge completed'}>
            unresolved multi-listing: {loading ? '...' : unresolvedMulti ?? 0}
          </span>
          <AvailabilityBadge availability={availabilityFor(tailPayload)} />
        </div>
      </div>

      <div className="entity-layer-two-column">
        <BreakdownBlock title="Reason buckets" rows={displayReasonRows} />
        <BreakdownBlock title="Segment" rows={displaySegmentRows} />
      </div>

      <div className="table-wrap">
        <table className="registry-table entity-layer-table">
          <thead>
            <tr>
              <th>Listing</th>
              <th>Status</th>
              <th>Segment</th>
              <th>Reason</th>
              <th>Importance</th>
              <th>Latest metadata market cap</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <EmptyRow colSpan={6} text="Loading tail rows..." /> : null}
            {!loading && rows.length === 0 ? <EmptyRow colSpan={6} text="No unresolved or provisional rows returned." /> : null}
            {!loading ? rows.map((row, index) => (
              <tr className={row.status === 'unresolved' ? 'danger-row' : undefined} key={`${row.symbol}-${row.reason}-${index}`}>
                <td>
                  <strong>{row.symbol}</strong>
                  <div className="small">{row.exchange} {row.isin}</div>
                </td>
                <td><span className={row.status === 'unresolved' ? 'badge failed' : 'badge running'}>{row.status}</span></td>
                <td>{row.segment}</td>
                <td>{row.reason}</td>
                <td>{row.importanceBucket}</td>
                <td>{row.marketCap}</td>
              </tr>
            )) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function SourceHealthPanel({ loading, rows, payload }: { loading: boolean; rows: SourceHealthRow[]; payload: unknown }) {
  return (
    <section className="card">
      <div className="split-row">
        <div>
          <h2>Source/cache health</h2>
          <p className="small">Entity-layer cache health across OpenFIGI, listing ISIN, and GLEIF lookup paths.</p>
        </div>
        <AvailabilityBadge availability={availabilityFor(payload)} />
      </div>

      <div className="table-wrap">
        <table className="registry-table entity-layer-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Success</th>
              <th>Not found</th>
              <th>Error</th>
              <th>Gaps</th>
              <th>Samples</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <EmptyRow colSpan={6} text="Loading source/cache health..." /> : null}
            {!loading && rows.length === 0 ? <EmptyRow colSpan={6} text="No source/cache health rows returned." /> : null}
            {!loading ? rows.map((row) => (
              <tr className={row.errorCount > 0 || row.gapCount > 0 ? 'danger-row' : undefined} key={row.source}>
                <td><strong>{row.source}</strong></td>
                <td>{formatCountWithPercent(row.successCount, row.totalCount)}</td>
                <td>{formatCountWithPercent(row.notFoundCount, row.totalCount)}</td>
                <td>{formatCountWithPercent(row.errorCount, row.totalCount)}</td>
                <td>{formatCountWithPercent(row.gapCount, row.totalCount)}</td>
                <td><SampleList samples={row.samples} /></td>
              </tr>
            )) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function EntityDrilldownTable({ loading, rows, payload }: { loading: boolean; rows: EntityRow[]; payload: unknown }) {
  return (
    <div className="table-wrap entity-layer-drilldown">
      <table className="registry-table entity-layer-table">
        <thead>
          <tr>
            <th>Entity</th>
            <th>LEI</th>
            <th>Home</th>
            <th>Listings</th>
            <th>Provenance</th>
            <th>Confidence</th>
            <th>Evidence</th>
          </tr>
        </thead>
        <tbody>
          {loading ? <EmptyRow colSpan={7} text="Loading entity drill-down..." /> : null}
          {!loading && rows.length === 0 ? <EmptyRow colSpan={7} text="No entities matched the query." /> : null}
          {!loading ? rows.map((row, index) => (
            <tr key={`${row.entityId}-${row.lei}-${index}`}>
              <td>
                <strong>{row.legalName}</strong>
                <div className="small">{row.entityId}</div>
              </td>
              <td>{row.lei}</td>
              <td>{row.homeCountry}</td>
              <td><ListingList listings={row.listings} /></td>
              <td>{row.provenance}</td>
              <td>{row.confidence}</td>
              <td>
                <details>
                  <summary>metadata/evidence</summary>
                  <pre>{JSON.stringify(row.evidence ?? row.metadata ?? payload, null, 2)}</pre>
                </details>
              </td>
            </tr>
          )) : null}
        </tbody>
      </table>
    </div>
  )
}

function ReviewQueuePanel({
  loading,
  queueAvailable,
  rows,
}: {
  loading: boolean
  queueAvailable: boolean | null
  rows: ReviewRow[]
}) {
  return (
    <section className="card">
      <div className="split-row">
        <div>
          <h2>Review queue</h2>
          <p className="small">Read-only `entity_identity_review` rows. Empty queue is valid.</p>
        </div>
        <span className={queueAvailable === false ? 'badge failed' : queueAvailable === true ? 'badge completed' : 'badge muted'}>
          queueAvailable: {queueAvailable === null ? 'unknown' : String(queueAvailable)}
        </span>
      </div>

      <div className="table-wrap">
        <table className="registry-table entity-layer-table">
          <thead>
            <tr>
              <th>Entity/listing</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <EmptyRow colSpan={4} text="Loading review queue..." /> : null}
            {!loading && rows.length === 0 ? <EmptyRow colSpan={4} text="No review items currently queued." /> : null}
            {!loading ? rows.map((row, index) => (
              <tr key={`${row.subject}-${row.reason}-${index}`}>
                <td><strong>{row.subject}</strong></td>
                <td>{row.reason}</td>
                <td>{row.status}</td>
                <td>
                  <details>
                    <summary>details</summary>
                    <pre>{JSON.stringify(row.raw, null, 2)}</pre>
                  </details>
                </td>
              </tr>
            )) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function KpiCard({
  label,
  value,
  sub,
  status,
}: {
  label: string
  value: string
  sub: string
  status?: 'completed' | 'running' | 'failed'
}) {
  return (
    <div className="card compact-card">
      <label>{label}</label>
      <div className="metric-value">{value}</div>
      <div className="small">{sub}</div>
      {status ? <span className={`badge ${status}`}>{status}</span> : null}
    </div>
  )
}

function BreakdownBlock({ title, rows }: { title: string; rows: CountRow[] }) {
  return (
    <div className="entity-layer-breakdown">
      <h3>{title}</h3>
      {rows.length === 0 ? <p className="small">No breakdown returned.</p> : null}
      {rows.map((row) => (
        <div className="entity-layer-breakdown-row" key={`${title}-${row.label}`}>
          <span>{row.label}</span>
          <strong>{row.value}</strong>
          {row.detail ? <small>{row.detail}</small> : null}
        </div>
      ))}
    </div>
  )
}

function TrendBlock({ rows }: { rows: CountRow[] }) {
  return (
    <div className="entity-layer-breakdown">
      <h3>Batch trend</h3>
      {rows.length === 0 ? <p className="small">No batch trend returned.</p> : null}
      {rows.map((row) => (
        <div className="entity-layer-breakdown-row" key={`trend-${row.label}`}>
          <span>{row.label}</span>
          <strong>{row.value}</strong>
          {row.detail ? <small>{row.detail}</small> : null}
        </div>
      ))}
    </div>
  )
}

function AvailabilityBadge({ availability }: { availability: AvailabilityState }) {
  const className = availability.available === false ? 'badge failed' : availability.available === true ? 'badge completed' : 'badge muted'
  return <span className={className}>{availability.label}</span>
}

function EndpointErrorPanel({ errors }: { errors: Partial<Record<EndpointKey, string>> }) {
  return (
    <div className="error">
      Entity Layer requests failed: {Object.entries(errors).map(([key, message]) => `${labelForEndpoint(key as EndpointKey)}: ${message}`).join('; ')}
    </div>
  )
}

function DegradedPanel({ endpoints }: { endpoints: Array<readonly [EndpointKey, AvailabilityState]> }) {
  return (
    <div className="warning">
      Degraded entity-layer availability: {endpoints.map(([key, availability]) => `${labelForEndpoint(key)} - ${availability.detail}`).join('; ')}
    </div>
  )
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td className="small" colSpan={colSpan}>{text}</td>
    </tr>
  )
}

function ListingList({ listings }: { listings: ListingRow[] }) {
  if (listings.length === 0) return <span className="small">No listings</span>
  return (
    <div className="entity-layer-listing-list">
      {listings.map((listing, index) => (
        <div key={`${listing.symbol}-${listing.exchange}-${index}`}>
          <strong>{listing.symbol}</strong>
          <span className="small"> {listing.exchange} {listing.isin}</span>
          <div className="small">{listing.attachMethod} {listing.confidence}</div>
        </div>
      ))}
    </div>
  )
}

function BadgeList({ values }: { values: string[] }) {
  if (values.length === 0) return <span className="small">-</span>
  return (
    <div className="meta">
      {values.map((value) => <span className="badge muted" key={value}>{value}</span>)}
    </div>
  )
}

function SampleList({ samples }: { samples: string[] }) {
  if (samples.length === 0) return <span className="small">No samples</span>
  return <span>{samples.slice(0, 5).join(', ')}</span>
}

type DedupGroup = {
  entityId: string
  legalName: string
  lei: string
  homeCountry: string
  listings: ListingRow[]
  attachMethods: string[]
}

type ListingRow = {
  symbol: string
  exchange: string
  isin: string
  attachMethod: string
  confidence: string
}

type TailRow = {
  symbol: string
  exchange: string
  isin: string
  status: string
  segment: string
  reason: string
  importanceBucket: string
  marketCap: string
}

type SourceHealthRow = {
  source: string
  successCount: number
  notFoundCount: number
  errorCount: number
  gapCount: number
  totalCount: number
  samples: string[]
}

type EntityRow = {
  entityId: string
  legalName: string
  lei: string
  homeCountry: string
  listings: ListingRow[]
  provenance: string
  confidence: string
  metadata: unknown
  evidence: unknown
}

type ReviewRow = {
  subject: string
  reason: string
  status: string
  raw: unknown
}

function normalizeSummary(payload: unknown) {
  const top = asRecord(payload) ?? {}
  const summary = firstRecord(top, ['summary', 'coverage', 'data']) ?? {}
  const countRoot = firstRecord(top, ['counts'])
    ?? firstRecord(summary, ['counts', 'coverage_counts', 'coverageCounts'])
    ?? top
  const availability = availabilityFor(payload)
  const entityMasterCount = readNumber(countRoot, ['entityMasterCount', 'entity_master_count', 'entities_count', 'entity_count', 'entities'])
  const listingCount = readNumber(countRoot, ['entityListingCount', 'entity_listing_count', 'listing_count', 'listings_count', 'listingCount', 'listings'])
  const resolvedCount = readNumber(countRoot, ['resolvedCount', 'resolved_count', 'resolved'])
  const provisionalCount = readNumber(countRoot, ['provisionalCount', 'provisional_count', 'provisional'])
  const unresolvedCount = readNumber(countRoot, ['unresolvedCount', 'unresolved_count', 'unresolved'])
  const statusTotal = listingCount ?? sumNumbers([resolvedCount, provisionalCount, unresolvedCount])

  return {
    availability,
    scope: readStringFromRecords([top, summary], ['scopeKey', 'scope_key', 'scope', 'universe', 'as_of_scope']) ?? 'scope unavailable',
    batchId: readStringFromRecords([top, summary], ['batchId', 'batch_id', 'batch'])
      ?? readString(firstRecord(top, ['batch']) ?? firstRecord(summary, ['batch']), ['id', 'batchId', 'batch_id'])
      ?? '-',
    entityMasterCount: formatCount(entityMasterCount),
    listingCount: formatCount(listingCount),
    resolvedCount: formatCount(resolvedCount),
    provisionalCount: formatCount(provisionalCount),
    unresolvedCount: formatCount(unresolvedCount),
    resolvedPercent: percentSubLabel(resolvedCount, statusTotal, 'attached listings'),
    provisionalPercent: percentSubLabel(provisionalCount, statusTotal, 'needs stronger evidence'),
    unresolvedPercent: percentSubLabel(unresolvedCount, statusTotal, 'no entity assignment'),
    attachMethods: normalizeBreakdown(firstValueFromRecords([top, summary], ['methods', 'attach_method_breakdown', 'attachMethodBreakdown', 'attach_methods', 'attachMethods', 'attach_method_counts'])),
    confidenceDistribution: normalizeBreakdown(firstValueFromRecords([top, summary], ['confidence', 'confidence_distribution', 'confidenceDistribution', 'confidence_counts'])),
    batchTrend: normalizeTrend(firstValueFromRecords([top, summary], ['batchTrend', 'batch_trend', 'trend', 'batches'])),
  }
}

function normalizeDedupGroups(payload: unknown): DedupGroup[] {
  return firstList<RowRecord>(payload, ['groups', 'rows', 'results', 'dedup_results', 'multi_listing_entities', 'entities', 'items', 'data'])
    .map((row) => {
      const record = asRecord(row) ?? {}
      const entity = firstRecord(record, ['entity', 'master', 'entity_master']) ?? record
      const listings = normalizeListings(firstValue(record, ['siblings', 'sibling_listings', 'listings', 'listing_siblings']))
      return {
        entityId: readString(entity, ['entity_id', 'entityId', 'id']) ?? '-',
        legalName: readString(entity, ['legal_name', 'legalName', 'name']) ?? '-',
        lei: readString(entity, ['lei', 'LEI']) ?? '-',
        homeCountry: readString(entity, ['home_country', 'homeCountry', 'country']) ?? '-',
        listings,
        attachMethods: uniqueStrings([
          ...normalizeStrings(firstValue(record, ['attach_methods', 'attachMethods', 'methods'])),
          ...listings.map((listing) => listing.attachMethod).filter((value) => value !== '-'),
        ]),
      }
    })
}

function normalizeTailRows(payload: unknown): TailRow[] {
  return firstList<RowRecord>(payload, ['rows', 'tail', 'results', 'items', 'data'])
    .map((row) => {
      const record = asRecord(row) ?? {}
      const listing = firstRecord(record, ['listing']) ?? record
      const isMulti = readBool(record, ['multi_listing', 'is_multi_listing', 'multiListing', 'isMultiListing'])
      const reason = readString(record, ['reason', 'reason_bucket', 'reasonBucket', 'unresolved_reason']) ?? '-'
      const resolutionStatus = readString(record, ['status', 'resolution_status', 'resolutionStatus'])
      return {
        symbol: readString(listing, ['symbol', 'ticker']) ?? '-',
        exchange: readString(listing, ['exchange', 'mic', 'venue']) ?? '',
        isin: readString(listing, ['isin', 'listing_isin', 'listingIsin']) ?? '',
        status: (resolutionStatus ?? (reason === 'provisional_only' ? 'provisional' : 'unresolved')).toLowerCase(),
        segment: readString(record, ['segment', 'listing_segment', 'listingSegment']) ?? (isMulti ? 'multi-listing' : 'single-listing'),
        reason,
        importanceBucket: readString(record, ['importance_bucket', 'importanceBucket', 'importance']) ?? '-',
        marketCap: formatValue(firstValue(record, ['providerMarketCap', 'provider_market_cap', 'localMarketCap', 'local_market_cap', 'market_cap', 'marketCap', 'market_cap_usd', 'marketCapUsd'])),
      }
    })
}

function normalizeSourceHealth(payload: unknown): SourceHealthRow[] {
  const healthRecords = sourceHealthRecords(payload)

  return healthRecords.map((row) => {
    const record = asRecord(row) ?? {}
    const counts = firstRecord(record, ['counts', 'summary', 'totals']) ?? record
    const source = readString(record, ['source', 'name', 'provider', 'cache']) ?? 'unknown'
    const successCount = readMetricCount(counts, ['success', 'success_count', 'successCount', 'cached_success', 'cachedSuccess', 'ok', 'okCount']) ?? 0
    const notFoundCount = readMetricCount(counts, ['not_found', 'notFound', 'not_found_count', 'notFoundCount', 'cached_not_found', 'cachedNotFound']) ?? 0
    const errorCount = readMetricCount(counts, ['error', 'errors', 'error_count', 'errorCount', 'cached_error', 'cachedError']) ?? 0
    const gapCount = readMetricCount(counts, ['gap', 'gaps', 'gap_count', 'gapCount', 'cache_gaps', 'cacheGaps']) ?? 0
    const totalCount = readMetricCount(counts, ['total', 'total_count', 'totalCount', 'sample_count', 'sampleCount'])
      ?? successCount + notFoundCount + errorCount + gapCount
    return {
      source: normalizeSourceLabel(source),
      successCount,
      notFoundCount,
      errorCount,
      gapCount,
      totalCount,
      samples: normalizeStrings(firstValue(record, ['samples', 'sample', 'examples', 'gaps_sample', 'gapSamples', 'sample_gaps', 'sampleGaps'])),
    }
  })
}

function sourceHealthRecords(payload: unknown): RowRecord[] {
  const listRows = firstList<RowRecord>(payload, ['sources', 'rows', 'source_health', 'sourceHealth', 'results', 'items', 'data'])
  if (listRows.length > 0) return listRows

  const top = asRecord(payload) ?? {}
  const root = mainRecord(payload, ['health', 'source_health', 'sourceHealth', 'data'])
  const sourceObject = asRecord(top.sources) ?? asRecord(root.sources)
  if (sourceObject) {
    const keyedRows = Object.entries(sourceObject)
      .filter(([, value]) => Boolean(asRecord(value)))
      .map(([source, value]) => ({ source, ...(asRecord(value) ?? {}) }))
    if (keyedRows.length > 0) return keyedRows
  }

  return sourceLabels.flatMap((label) => {
    const record = asRecord(root[label]) ?? asRecord(root[slugKey(label)]) ?? asRecord(root[label.toLowerCase()])
    return record ? [{ source: label, ...record }] : []
  })
}

function normalizeEntityRows(payload: unknown): EntityRow[] {
  return firstList<RowRecord>(payload, ['entities', 'rows', 'results', 'items', 'data'])
    .map((row) => {
      const record = asRecord(row) ?? {}
      const entity = firstRecord(record, ['entity', 'master', 'entity_master']) ?? record
      return {
        entityId: readString(entity, ['entity_id', 'entityId', 'id']) ?? '-',
        legalName: readString(entity, ['legal_name', 'legalName', 'name']) ?? '-',
        lei: readString(entity, ['lei', 'LEI']) ?? '-',
        homeCountry: readString(entity, ['home_country', 'homeCountry', 'country']) ?? '-',
        listings: normalizeListings(firstValue(record, ['listings', 'sibling_listings', 'siblings'])),
        provenance: readString(record, ['provenance', 'source', 'attach_source', 'attachSource']) ?? '-',
        confidence: formatValue(firstValue(record, ['confidence', 'confidence_score', 'confidenceScore'])),
        metadata: firstValue(record, ['metadata', 'meta']),
        evidence: firstValue(record, ['evidence', 'evidence_json', 'evidenceJson']),
      }
    })
}

function normalizeReviewRows(payload: unknown): ReviewRow[] {
  return firstList<RowRecord>(payload, ['rows', 'review', 'queue', 'items', 'data', 'results'])
    .map((row) => {
      const record = asRecord(row) ?? {}
      return {
        subject: readString(record, ['subject', 'entity_id', 'entityId', 'symbol', 'listing_symbol']) ?? '-',
        reason: readString(record, ['reason', 'reason_bucket', 'reasonBucket']) ?? '-',
        status: readString(record, ['status', 'state']) ?? '-',
        raw: record,
      }
    })
}

function normalizeListings(value: unknown): ListingRow[] {
  const rows = Array.isArray(value) ? value : firstList(value, ['rows', 'listings', 'items'])
  return rows.map((row) => {
    const record = asRecord(row) ?? {}
    return {
      symbol: readString(record, ['symbol', 'ticker']) ?? '-',
      exchange: readString(record, ['exchange', 'mic', 'venue']) ?? '',
      isin: readString(record, ['isin', 'listing_isin', 'listingIsin']) ?? '',
      attachMethod: readString(record, ['attach_method', 'attachMethod', 'method']) ?? '-',
      confidence: formatValue(firstValue(record, ['confidence', 'confidence_score', 'confidenceScore'])),
    }
  })
}

function normalizeBreakdown(value: unknown): CountRow[] {
  if (Array.isArray(value)) {
    const counts = value.map((item) => {
      const record = asRecord(item)
      return readNumber(record, ['count', 'value', 'total'])
    })
    const total = sumNumbers(counts)
    return value.map((item, index) => {
      const record = asRecord(item)
      const count = counts[index]
      return {
        label: readString(record, ['label', 'bucket', 'method', 'name', 'key']) ?? `bucket ${index + 1}`,
        value: formatCount(count),
        detail: readPercent(record, ['share', 'pct', 'percent', 'ratio']) ?? formatPercent(count, total),
      }
    })
  }

  const record = asRecord(value)
  if (!record) return []
  const entries = Object.entries(record)
  const numericValues = entries.map(([, raw]) => breakdownCount(raw))
  const total = sumNumbers(numericValues)
  return entries.map(([label, raw], index) => ({
    label: readString(asRecord(raw), ['label', 'bucket', 'method', 'name', 'key']) ?? label,
    value: formatCount(numericValues[index]) !== '-' ? formatCount(numericValues[index]) : formatValue(raw),
    detail: readPercent(asRecord(raw), ['share', 'pct', 'percent', 'ratio']) ?? formatPercent(numericValues[index], total),
  }))
}

function normalizeTrend(value: unknown): CountRow[] {
  if (Array.isArray(value)) {
    return value.slice(-8).map((item, index) => {
      const record = asRecord(item)
      return {
        label: readString(record, ['batch_id', 'batchId', 'batch', 'date']) ?? `batch ${index + 1}`,
        value: formatCount(readNumber(record, ['entityListingCount', 'entity_listing_count', 'listing_count', 'listings', 'entity_count', 'entities', 'count'])),
        detail: readString(record, ['status', 'availability', 'scopeKey', 'scope']) ?? undefined,
      }
    })
  }
  return normalizeBreakdown(value)
}

function bucketRows<T>(rows: T[], keyFn: (row: T) => string): CountRow[] {
  const counts = new Map<string, number>()
  rows.forEach((row) => {
    const key = keyFn(row) || '-'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  })
  const total = rows.length
  return [...counts.entries()].map(([label, count]) => ({
    label,
    value: String(count),
    detail: formatPercent(count, total),
  }))
}

function availabilityFor(payload: unknown): AvailabilityState {
  const record = asRecord(payload)
  const rawAvailability = firstValueFromRecords([record, firstRecord(record, ['summary', 'data'])], ['availability', 'available'])
  const availability = asRecord(rawAvailability)
  if (!availability) {
    if (typeof rawAvailability === 'string' && rawAvailability.trim()) {
      const inferred = inferAvailability(rawAvailability)
      return {
        label: inferred === false ? 'degraded' : inferred === true ? 'available' : rawAvailability,
        available: inferred,
        detail: rawAvailability,
      }
    }
    if (typeof rawAvailability === 'boolean') {
      return {
        label: rawAvailability ? 'available' : 'degraded',
        available: rawAvailability,
        detail: rawAvailability ? 'available' : 'unavailable',
      }
    }
    return { label: 'availability unknown', available: null, detail: 'availability not returned' }
  }

  const available = readBool(availability, ['available', 'is_available', 'isAvailable'])
  const status = readString(availability, ['status', 'state'])
  const reason = readString(availability, ['reason', 'message', 'detail', 'details'])
  const inferred = available ?? inferAvailability(status)
  const label = inferred === false ? 'degraded' : inferred === true ? 'available' : status ?? 'availability unknown'

  return {
    label,
    available: inferred,
    detail: reason ?? status ?? label,
  }
}

function inferAvailability(status: string | null): boolean | null {
  const normalized = status?.trim().toLowerCase()
  if (!normalized) return null
  if (['available', 'ok', 'ready', 'healthy', 'success'].includes(normalized)) return true
  if (['unavailable', 'disabled', 'missing', 'error', 'failed', 'degraded'].includes(normalized)) return false
  return null
}

function readQueueAvailable(payload: unknown): boolean | null {
  const record = asRecord(payload)
  return readBool(record, ['queueAvailable', 'queue_available'])
    ?? readBool(asRecord(record?.availability), ['queueAvailable', 'queue_available'])
}

function mainRecord(payload: unknown, keys: string[]): RowRecord {
  const record = asRecord(payload)
  if (!record) return {}
  for (const key of keys) {
    const nested = asRecord(record[key])
    if (nested) return nested
  }
  return record
}

function firstRecord(record: RowRecord | null | undefined, keys: string[]): RowRecord | null {
  if (!record) return null
  for (const key of keys) {
    const nested = asRecord(record[key])
    if (nested) return nested
  }
  return null
}

function firstValue(record: RowRecord | null | undefined, keys: string[]): unknown {
  if (!record) return undefined
  for (const key of keys) {
    if (record[key] !== undefined) return record[key]
  }
  return undefined
}

function firstValueFromRecords(records: Array<RowRecord | null | undefined>, keys: string[]): unknown {
  for (const record of records) {
    const value = firstValue(record, keys)
    if (value !== undefined) return value
  }
  return undefined
}

function readString(record: RowRecord | null | undefined, keys: string[]): string | null {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  }
  return null
}

function readStringFromRecords(records: Array<RowRecord | null | undefined>, keys: string[]): string | null {
  for (const record of records) {
    const value = readString(record, keys)
    if (value !== null) return value
  }
  return null
}

function readNumber(record: RowRecord | null | undefined, keys: string[]): number | null {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  }
  return null
}

function readMetricCount(record: RowRecord | null | undefined, keys: string[]): number | null {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (Array.isArray(value)) return value.length
    const numberValue = readNumericValue(value)
    if (numberValue !== null) return numberValue
  }
  return null
}

function readNumberFromAny(payloads: unknown[], keys: string[]): number | null {
  for (const payload of payloads) {
    const top = asRecord(payload) ?? {}
    const summary = firstRecord(top, ['summary', 'tail', 'data'])
    const value = readNumberFromRecords([top, summary], keys)
    if (value !== null) return value
  }
  return null
}

function readNumberFromRecords(records: Array<RowRecord | null | undefined>, keys: string[]): number | null {
  for (const record of records) {
    const value = readNumber(record, keys)
    if (value !== null) return value
  }
  return null
}

function readBool(record: RowRecord | null | undefined, keys: string[]): boolean | null {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (normalized === 'true') return true
      if (normalized === 'false') return false
    }
  }
  return null
}

function readNumericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

function breakdownCount(value: unknown): number | null {
  const direct = readNumericValue(value)
  if (direct !== null) return direct
  const record = asRecord(value)
  return readNumber(record, ['count', 'value', 'total'])
}

function readPercent(record: RowRecord | null | undefined, keys: string[]): string | undefined {
  if (!record) return undefined
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return formatPercentValue(value)
    }
    if (typeof value === 'string' && value.trim()) {
      if (value.includes('%')) return value.trim()
      if (Number.isFinite(Number(value))) return formatPercentValue(Number(value))
    }
  }
  return undefined
}

function normalizeStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    if (typeof value === 'string' && value.trim()) return [value.trim()]
    return []
  }
  return value
    .map((item) => {
      if (typeof item === 'string') return item
      const record = asRecord(item)
      return readString(record, ['symbol', 'value', 'sample', 'id', 'name']) ?? JSON.stringify(item)
    })
    .filter(Boolean)
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function normalizeSourceLabel(source: string): string {
  const normalized = source.toLowerCase().replaceAll('_', ' ').replaceAll('-', ' ')
  const known = sourceLabels.find((label) => normalized === label.toLowerCase().replaceAll('->', ' ').replaceAll('-', ' '))
  return known ?? source
}

function slugKey(label: string): string {
  return label.toLowerCase().replaceAll(' ', '_').replaceAll('-', '_').replaceAll('->', '_to_')
}

function formatCount(value: number | null | undefined): string {
  return value === null || value === undefined ? '-' : new Intl.NumberFormat('en-US').format(value)
}

function formatCountWithPercent(value: number, total: number): string {
  const percent = formatPercent(value, total)
  return percent ? `${formatCount(value)} (${percent})` : formatCount(value)
}

function formatPercent(value: number | null | undefined, total: number | null | undefined): string | undefined {
  if (value === null || value === undefined || total === null || total === undefined || total <= 0) return undefined
  return `${formatCompactPercent((value / total) * 100)}%`
}

function formatPercentValue(value: number): string {
  const percent = value <= 1 ? value * 100 : value
  return `${formatCompactPercent(percent)}%`
}

function formatCompactPercent(value: number): string {
  if (!Number.isFinite(value)) return '-'
  if (value === 0 || value === 100) return String(Math.round(value))
  if (value >= 10) return value.toFixed(1).replace(/\.0$/, '')
  return value.toFixed(2).replace(/0$/, '').replace(/\.0$/, '')
}

function percentSubLabel(value: number | null, total: number | null, fallback: string): string {
  const percent = formatPercent(value, total)
  return percent ? `${percent} ${fallback}` : fallback
}

function sumNumbers(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (valid.length === 0) return null
  return valid.reduce((sum, value) => sum + value, 0)
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'number') return Number.isInteger(value) ? formatCount(value) : value.toFixed(3)
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function errorMessage(error: unknown): string {
  const record = asRecord(error)
  return readString(record, ['message', 'error']) ?? (error instanceof Error ? error.message : 'Unknown request error.')
}

function labelForEndpoint(key: EndpointKey): string {
  if (key === 'sourceHealth') return 'source-health'
  return key
}
