'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { requestClientJson } from '@/lib/client-json'
import { asRecord, firstList, type RowRecord } from '@/lib/payload'
import { RelationshipMapCoveragePanel } from '@/components/relationship-map/RelationshipMapCoveragePanel'
import { RelationshipMapFrontierPanel } from '@/components/relationship-map/RelationshipMapFrontierPanel'

type Props = {
  adminActor: string
}

type WorkspaceTab = 'source-health' | 'coverage' | 'frontier'

type ThemeHealthRow = {
  theme: string
  etf: string
  source: string
  holdingsCount: number | null
  holdingsAsOf: string | null
  ageDays: number | null
  active: boolean
  stale: boolean
  empty: boolean
  noEdges: boolean
  pendingCoverage: boolean
  shallow: boolean
  weightHygieneAdjusted: boolean
  relationshipMapEligible: boolean | null
  relationshipMapIneligibleReason: string | null
  technicalConstituentCount: number | null
  pricedConstituentCount: number | null
  coverageRatio: number | null
}

type Rollup = {
  status: 'green' | 'yellow' | 'red' | 'gray'
  lastBuildLabel: string
  buildRanToday: boolean | null
  expectedBuildWindowHours: number | null
  totalThemes: number
  activeThemes: number
  noEdges: number
  empty: number
  stale: number
  pendingCoverage: number
  shallow: number
  weightHygieneAdjusted: number
  edgeSummary: string
}

export function RelationshipMapHealthWorkspace({ adminActor }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = normalizeTab(searchParams.get('tab'))
  const [payload, setPayload] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    let cancelled = false

    async function loadHealth() {
      setLoading(true)
      setError(null)
      try {
        const response = await requestClientJson('/api/relationship-map/source-health')
        if (!cancelled) setPayload(response)
      } catch (requestError) {
        if (!cancelled) {
          setPayload(null)
          setError(requestError)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadHealth()
    return () => {
      cancelled = true
    }
  }, [])

  const themes = useMemo(() => normalizeThemes(payload), [payload])
  const rollup = useMemo(() => buildRollup(payload, themes), [payload, themes])
  const sortedThemes = useMemo(() => [...themes].sort(compareThemeRows), [themes])
  const unavailable = Boolean(error && !loading)

  function selectTab(tab: WorkspaceTab) {
    const params = new URLSearchParams(searchParams.toString())
    if (tab === 'source-health') {
      params.delete('tab')
    } else {
      params.set('tab', tab)
    }
    const query = params.toString()
    router.replace(query ? `/relationship-map?${query}` : '/relationship-map', { scroll: false })
  }

  return (
    <div className="page-stack">
      <div className="card">
        <div className="split-row">
          <div>
            <p className="eyebrow">Correlation system</p>
            <h1>Relationship map</h1>
            <p className="small">Source health, current universe coverage, and growth frontier for relationship edges.</p>
          </div>
          <div className="small">Admin: {adminActor}</div>
        </div>
      </div>

      <div className="relationship-map-tabs" role="tablist" aria-label="Relationship map workspace sections">
        <button
          aria-selected={activeTab === 'source-health'}
          className={activeTab === 'source-health' ? 'active' : ''}
          onClick={() => selectTab('source-health')}
          role="tab"
          type="button"
        >
          Source health
        </button>
        <button
          aria-selected={activeTab === 'coverage'}
          className={activeTab === 'coverage' ? 'active' : ''}
          onClick={() => selectTab('coverage')}
          role="tab"
          type="button"
        >
          Coverage
        </button>
        <button
          aria-selected={activeTab === 'frontier'}
          className={activeTab === 'frontier' ? 'active' : ''}
          onClick={() => selectTab('frontier')}
          role="tab"
          type="button"
        >
          Frontier / Grow
        </button>
      </div>

      {activeTab === 'coverage' ? <RelationshipMapCoveragePanel /> : null}
      {activeTab === 'frontier' ? <RelationshipMapFrontierPanel /> : null}

      {activeTab !== 'source-health' ? null : (
        <>
          {error ? <SourceHealthError error={error} /> : null}

          <div className="metric-grid">
            <KpiCard
              label="Pipeline status"
              value={loading ? '...' : statusLabel(rollup.status)}
              sub={loading ? 'Checking relationship-map source health' : `last build: ${rollup.lastBuildLabel}, ${buildFreshnessLabel(rollup.buildRanToday, rollup.expectedBuildWindowHours)}`}
              status={rollup.status}
            />
            <KpiCard
              label="Active themes"
              value={loading ? '...' : unavailable ? '-' : `${rollup.activeThemes}/${rollup.totalThemes}`}
              sub={unavailable ? 'Endpoint unavailable' : 'Themes enabled for map publication'}
            />
            <KpiCard
              label="Red flags"
              value={loading ? '...' : unavailable ? '-' : String(rollup.noEdges + rollup.empty)}
              sub={unavailable ? 'Endpoint unavailable' : `${rollup.noEdges} no-edges, ${rollup.empty} empty`}
              status={unavailable ? 'gray' : rollup.noEdges + rollup.empty > 0 ? 'red' : 'green'}
            />
          </div>

          <section className="card">
            <div className="split-row">
              <div>
                <h2>Source health</h2>
                <p className="small">
                  Problems are sorted first. No edges means an active theme has holdings but did not publish relationship edges in the latest build.
                </p>
              </div>
              <span className={`badge ${statusBadgeClass(rollup.status)}`}>{statusLabel(rollup.status)}</span>
            </div>

            <div className="status-chip-row">
              <span className="badge failed">no edges: {countLabel(rollup.noEdges, unavailable)}</span>
              <span className="badge failed">empty: {countLabel(rollup.empty, unavailable)}</span>
              <span className="badge running">stale: {countLabel(rollup.stale, unavailable)}</span>
              <span className="badge running">pending coverage: {countLabel(rollup.pendingCoverage, unavailable)}</span>
              <span className="badge backend-gap">shallow: {countLabel(rollup.shallow, unavailable)}</span>
              <span className="badge backend-gap">weight hygiene adjusted: {countLabel(rollup.weightHygieneAdjusted, unavailable)}</span>
            </div>

            <div className="small relationship-map-build-line">
              Edge build sanity: {rollup.edgeSummary}
            </div>

            <div className="table-wrap relationship-map-table">
              <table className="registry-table">
                <thead>
                  <tr>
                    <th>Theme</th>
                    <th>ETF</th>
                    <th>Source</th>
                    <th>Holdings</th>
                    <th>Technical</th>
                    <th>Priced</th>
                    <th>Coverage</th>
                    <th>Eligibility</th>
                    <th>As of</th>
                    <th>Age</th>
                    <th>Flags</th>
                    <th>What it means</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="small" colSpan={12}>Loading relationship-map source health...</td>
                    </tr>
                  ) : null}
                  {!loading && sortedThemes.length === 0 ? (
                    <tr>
                      <td className="small" colSpan={12}>
                        {error ? 'Relationship-map source health is unavailable.' : 'No relationship-map source health rows were returned.'}
                      </td>
                    </tr>
                  ) : null}
                  {!loading ? sortedThemes.map((theme, index) => (
                    <tr className={theme.noEdges || theme.empty ? 'danger-row' : undefined} key={rowKey(theme, index)}>
                      <td>
                        <strong>{theme.theme}</strong>
                        {!theme.active ? <div className="small">inactive</div> : null}
                      </td>
                      <td>{theme.etf}</td>
                      <td>{theme.source}</td>
                      <td>{theme.holdingsCount === null ? '—' : theme.holdingsCount}</td>
                      <td>{theme.technicalConstituentCount === null ? '—' : theme.technicalConstituentCount}</td>
                      <td>{theme.pricedConstituentCount === null ? '—' : theme.pricedConstituentCount}</td>
                      <td>{formatRatio(theme.coverageRatio)}</td>
                      <td>
                        {eligibilityLabel(theme)}
                        {theme.relationshipMapIneligibleReason ? <div className="small">{theme.relationshipMapIneligibleReason}</div> : null}
                      </td>
                      <td>{theme.holdingsAsOf ?? '—'}</td>
                      <td>{theme.ageDays === null ? '—' : `${theme.ageDays}d`}</td>
                      <td><FlagBadges theme={theme} /></td>
                      <td>{plainLanguage(theme)}</td>
                    </tr>
                  )) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function normalizeTab(value: string | null): WorkspaceTab {
  if (value === 'coverage' || value === 'frontier') return value
  return 'source-health'
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
  status?: Rollup['status']
}) {
  return (
    <div className="card compact-card">
      <label>{label}</label>
      <div className={`metric-value ${statusTextClass(status)}`}>{value}</div>
      <div className="small">{sub}</div>
    </div>
  )
}

function SourceHealthError({ error }: { error: unknown }) {
  const record = asRecord(error)
  const message = readString(record, ['message', 'error']) ?? (error instanceof Error ? error.message : 'Relationship-map source health is unavailable.')

  return (
    <div className="alert error">
      <strong>Relationship-map source health unavailable.</strong>
      <div>{message}</div>
      {typeof record?.upstreamStatus === 'number' ? <div className="small">Upstream status: {record.upstreamStatus}</div> : null}
      {typeof record?.upstreamContentType === 'string' ? <div className="small">Content-Type: {record.upstreamContentType}</div> : null}
      {typeof record?.upstreamBodyPreview === 'string' && record.upstreamBodyPreview ? <pre>{record.upstreamBodyPreview}</pre> : null}
    </div>
  )
}

function FlagBadges({ theme }: { theme: ThemeHealthRow }) {
  const flags = [
    theme.noEdges ? <span className="badge failed" key="no-edges">no edges</span> : null,
    theme.empty ? <span className="badge failed" key="empty">empty</span> : null,
    theme.stale ? <span className="badge running" key="stale">stale</span> : null,
    theme.pendingCoverage ? <span className="badge running" key="pending-coverage">pending coverage</span> : null,
    theme.shallow ? <span className="badge backend-gap" key="shallow">shallow</span> : null,
    theme.weightHygieneAdjusted ? <span className="badge backend-gap" key="weight-hygiene">weight hygiene adjusted</span> : null,
  ].filter(Boolean)

  if (flags.length === 0) return <span className="badge completed">healthy</span>
  return <div className="status-chip-row relationship-map-flags">{flags}</div>
}

function normalizeThemes(payload: unknown): ThemeHealthRow[] {
  return firstList(payload, ['themes', 'items', 'rows', ['data', 'themes'], ['data', 'items']])
    .map((row) => normalizeTheme(row))
    .filter((row): row is ThemeHealthRow => Boolean(row))
}

function normalizeTheme(row: unknown): ThemeHealthRow | null {
  const record = asRecord(row)
  if (!record) return null

  const holdingsCount = readNumber(record, ['holdings_count', 'holdingsCount'])
  const active = readBoolean(record, ['active', 'is_active', 'isActive']) ?? true
  const shallow = readBoolean(record, ['holdings_shallow', 'holdingsShallow', 'shallow']) ?? hasFlag(record, 'shallow')
  const noEdges = readBoolean(record, ['no_edges', 'noEdges']) ?? hasFlag(record, 'no_edges') ?? hasFlag(record, 'no-edges')
  const pendingCoverage = readBoolean(record, ['pendingCoverage', 'pending_coverage'])
    ?? hasFlag(record, 'pendingCoverage')
    ?? hasFlag(record, 'pending_coverage')
    ?? hasFlag(record, 'pending-coverage')
  const empty = readBoolean(record, ['empty']) ?? hasFlag(record, 'empty') ?? (active && holdingsCount === 0)
  const stale = readBoolean(record, ['stale']) ?? hasFlag(record, 'stale')
  const weightHygieneAdjusted = readBoolean(record, ['weight_hygiene_adjusted', 'weightHygieneAdjusted'])
    ?? hasFlag(record, 'weight_hygiene_adjusted')
    ?? hasFlag(record, 'weight-hygiene-adjusted')

  return {
    theme: readString(record, ['theme', 'theme_name', 'themeName', 'name']) ?? '—',
    etf: readString(record, ['etf', 'ticker', 'symbol']) ?? '—',
    source: readString(record, ['source', 'issuer', 'provider']) ?? '—',
    holdingsCount,
    holdingsAsOf: readString(record, ['holdings_as_of', 'holdingsAsOf', 'as_of', 'asOf']),
    ageDays: readNumber(record, ['age_days', 'ageDays', 'holdings_age_days', 'holdingsAgeDays']),
    active,
    stale,
    empty,
    noEdges,
    pendingCoverage,
    shallow,
    weightHygieneAdjusted,
    relationshipMapEligible: readBoolean(record, ['relationshipMapEligible', 'relationship_map_eligible']),
    relationshipMapIneligibleReason: readString(record, ['relationshipMapIneligibleReason', 'relationship_map_ineligible_reason']),
    technicalConstituentCount: readNumber(record, ['technicalConstituentCount', 'technical_constituent_count']),
    pricedConstituentCount: readNumber(record, ['pricedConstituentCount', 'priced_constituent_count']),
    coverageRatio: readNumber(record, ['coverageRatio', 'coverage_ratio']),
  }
}

function buildRollup(payload: unknown, themes: ThemeHealthRow[]): Rollup {
  const record = asRecord(payload)
  if (!record) {
    return {
      status: 'gray',
      lastBuildLabel: '—',
      buildRanToday: null,
      expectedBuildWindowHours: null,
      totalThemes: 0,
      activeThemes: 0,
      noEdges: 0,
      empty: 0,
      stale: 0,
      pendingCoverage: 0,
      shallow: 0,
      weightHygieneAdjusted: 0,
      edgeSummary: 'not returned by backend',
    }
  }

  const rollupRecord = asRecord(record?.rollup) ?? asRecord(record?.summary) ?? null
  const pipelineRecord = asRecord(record?.pipeline)
  const configRecord = asRecord(record?.config)
  const lastBuildRecord = asRecord(record?.lastBuild)
    ?? asRecord(record?.last_build)
    ?? asRecord(pipelineRecord?.lastBuild)
    ?? asRecord(pipelineRecord?.last_build)
    ?? pipelineRecord
    ?? null
  const countsRecord = asRecord(rollupRecord?.counts)
    ?? asRecord(rollupRecord?.flagCounts)
    ?? asRecord(rollupRecord?.flag_counts)
    ?? asRecord(rollupRecord?.counts_by_flag)
    ?? asRecord(record?.flagCounts)
    ?? asRecord(record?.flag_counts)
    ?? asRecord(record?.counts_by_flag)

  const noEdges = readCount(rollupRecord, countsRecord, ['no_edges', 'noEdges'], themes.filter((theme) => theme.noEdges).length)
  const empty = readCount(rollupRecord, countsRecord, ['empty'], themes.filter((theme) => theme.empty).length)
  const stale = readCount(rollupRecord, countsRecord, ['stale'], themes.filter((theme) => theme.stale).length)
  const pendingCoverage = readCount(rollupRecord, countsRecord, ['pendingCoverage', 'pending_coverage'], themes.filter((theme) => theme.pendingCoverage).length)
  const shallow = readCount(rollupRecord, countsRecord, ['shallow', 'holdings_shallow', 'holdingsShallow'], themes.filter((theme) => theme.shallow).length)
  const weightHygieneAdjusted = readCount(
    rollupRecord,
    countsRecord,
    ['weight_hygiene_adjusted', 'weightHygieneAdjusted'],
    themes.filter((theme) => theme.weightHygieneAdjusted).length
  )
  const buildRanToday = readBoolean(record ?? {}, ['buildRanToday', 'build_ran_today'])
    ?? readBoolean(pipelineRecord ?? {}, ['buildRanToday', 'build_ran_today'])
    ?? readBoolean(lastBuildRecord ?? {}, ['buildRanToday', 'build_ran_today', 'ran_today'])
  const explicitStatus = normalizeStatus(readString(record, ['status']) ?? readString(rollupRecord, ['status']))
  const expectedBuildWindowHours = readNumber(configRecord, ['expectedBuildWindowHours', 'expected_build_window_hours'])
  const status = explicitStatus ?? deriveStatus({ noEdges, empty, stale, pendingCoverage, shallow, weightHygieneAdjusted, buildRanToday })

  return {
    status,
    lastBuildLabel: formatLastBuild(lastBuildRecord, record),
    buildRanToday,
    expectedBuildWindowHours,
    totalThemes: readCount(rollupRecord, countsRecord, ['themeCount', 'total_themes', 'totalThemes'], themes.length),
    activeThemes: readCount(rollupRecord, countsRecord, ['activeThemeCount', 'active_themes', 'activeThemes'], themes.filter((theme) => theme.active).length),
    noEdges,
    empty,
    stale,
    pendingCoverage,
    shallow,
    weightHygieneAdjusted,
    edgeSummary: formatEdgeSummary(record),
  }
}

function compareThemeRows(a: ThemeHealthRow, b: ThemeHealthRow): number {
  const scoreDelta = rowScore(b) - rowScore(a)
  if (scoreDelta !== 0) return scoreDelta
  return `${a.theme} ${a.etf}`.localeCompare(`${b.theme} ${b.etf}`)
}

function rowScore(theme: ThemeHealthRow): number {
  let score = 0
  if (theme.noEdges) score += 100
  if (theme.empty) score += 90
  if (theme.stale) score += 80
  if (theme.pendingCoverage) score += 70
  if (theme.shallow) score += 20
  if (theme.weightHygieneAdjusted) score += 10
  if (!theme.active) score -= 10
  return score
}

function plainLanguage(theme: ThemeHealthRow): string {
  if (theme.noEdges) return 'No edges - this theme published nothing to the map.'
  if (theme.empty) return 'Empty - this active source has no holdings.'
  if (theme.stale) return `Stale - holdings are ${theme.ageDays === null ? 'older than expected' : `${theme.ageDays} days old`}.`
  if (theme.pendingCoverage) return 'Pending coverage - ETF/theme is active, but not enough constituents have materialized price/technical coverage yet. It will become eligible automatically as coverage improves.'
  if (theme.shallow) return 'Shallow - holdings came from a truncated source.'
  if (theme.weightHygieneAdjusted) return 'Weight hygiene adjusted - edge weights were clamped or normalized.'
  if (!theme.active) return 'Inactive - not expected to publish relationship edges.'
  return 'Healthy - source is current and represented in the latest map build.'
}

function statusLabel(status: Rollup['status']): string {
  if (status === 'green') return 'Green'
  if (status === 'yellow') return 'Yellow'
  if (status === 'red') return 'Red'
  return 'Unknown'
}

function buildFreshnessLabel(value: boolean | null, expectedBuildWindowHours: number | null): string {
  const windowLabel = expectedBuildWindowHours === null ? 'configured build window' : `${expectedBuildWindowHours}h window`
  if (value === true) return `Fresh within ${windowLabel} ✔`
  if (value === false) return `Outside ${windowLabel} ✘`
  return expectedBuildWindowHours === null ? 'Build freshness unknown' : `Build freshness unknown for ${windowLabel}`
}

function countLabel(value: number, unavailable: boolean): string {
  return unavailable ? '-' : String(value)
}

function statusBadgeClass(status: Rollup['status']): string {
  if (status === 'green') return 'completed'
  if (status === 'yellow') return 'running'
  if (status === 'red') return 'failed'
  return 'queued'
}

function statusTextClass(status?: Rollup['status']): string {
  if (status === 'green') return 'text-green'
  if (status === 'yellow') return 'text-amber'
  if (status === 'red') return 'text-red'
  return ''
}

function deriveStatus({
  noEdges,
  empty,
  stale,
  pendingCoverage,
  shallow,
  weightHygieneAdjusted,
  buildRanToday,
}: {
  noEdges: number
  empty: number
  stale: number
  pendingCoverage: number
  shallow: number
  weightHygieneAdjusted: number
  buildRanToday: boolean | null
}): Rollup['status'] {
  if (noEdges > 0 || empty > 0 || buildRanToday === false) return 'red'
  if (stale > 0 || pendingCoverage > 0 || shallow > 0 || weightHygieneAdjusted > 0) return 'yellow'
  return 'green'
}

function normalizeStatus(status: string | null): Rollup['status'] | null {
  const normalized = status?.trim().toLowerCase()
  if (normalized === 'green' || normalized === 'ok' || normalized === 'healthy') return 'green'
  if (normalized === 'yellow' || normalized === 'warning' || normalized === 'partial') return 'yellow'
  if (normalized === 'red' || normalized === 'failed' || normalized === 'error') return 'red'
  return null
}

function formatLastBuild(lastBuild: RowRecord | null, payload: RowRecord | null): string {
  const date = readString(lastBuild, ['as_of_date', 'asOfDate', 'as_of', 'asOf'])
    ?? readString(payload, ['lastBuild', 'last_build', 'latest_as_of_date', 'latestAsOfDate'])
  const computed = readString(lastBuild, ['computed_at', 'computedAt', 'built_at', 'builtAt'])
  if (date && computed) return `${date} (${formatDateTime(computed)})`
  if (date) return date
  if (computed) return formatDateTime(computed)
  return '—'
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function formatRatio(value: number | null): string {
  if (value === null) return '—'
  if (value <= 1) return `${Math.round(value * 100)}%`
  return `${Math.round(value)}%`
}

function eligibilityLabel(theme: ThemeHealthRow): string {
  if (theme.relationshipMapEligible === true) return 'Eligible'
  if (theme.relationshipMapEligible === false) return 'Not eligible'
  return 'Unknown'
}

function formatEdgeSummary(payload: RowRecord | null): string {
  const pipeline = asRecord(payload?.pipeline)
  const value = payload?.edgeCountsByLayerWindow
    ?? payload?.edge_counts_by_layer_window
    ?? pipeline?.edgeCountsByLayerWindow
    ?? pipeline?.edge_counts_by_layer_window
    ?? asRecord(payload?.lastBuild)?.edgeCountsByLayerWindow
    ?? asRecord(payload?.last_build)?.edge_counts_by_layer_window
  if (!value) return 'not returned by backend'
  if (Array.isArray(value)) {
    if (value.length === 0) return '0 latest-build edge groups'
    return `${value.length} latest-build layer/window group${value.length === 1 ? '' : 's'}`
  }
  const record = asRecord(value)
  if (!record) return 'returned'
  const entries = Object.entries(record)
  if (entries.length === 0) return '0 latest-build edge groups'
  const total = entries.reduce((sum, [, count]) => sum + (typeof count === 'number' ? count : 0), 0)
  return total > 0 ? `${total} edges across ${entries.length} layer/window group${entries.length === 1 ? '' : 's'}` : `${entries.length} layer/window group${entries.length === 1 ? '' : 's'}`
}

function readCount(record: RowRecord | null, nestedRecord: RowRecord | null, keys: string[], fallback: number): number {
  const value = readNumber(record, keys) ?? readNumber(nestedRecord, keys)
  return value === null ? fallback : value
}

function readString(record: RowRecord | null | undefined, keys: string[]): string | null {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  }
  return null
}

function readNumber(record: RowRecord | null | undefined, keys: string[]): number | null {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function readBoolean(record: RowRecord | null | undefined, keys: string[]): boolean | null {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value !== 0
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (['true', 'yes', '1'].includes(normalized)) return true
      if (['false', 'no', '0'].includes(normalized)) return false
    }
  }
  return null
}

function hasFlag(record: RowRecord, flag: string): boolean {
  const normalizedFlag = flag.trim().toLowerCase()
  const flags = record.flags
  if (Array.isArray(flags)) {
    return flags.map((item) => String(item).trim().toLowerCase()).includes(normalizedFlag)
  }
  const flagRecord = asRecord(flags)
  return readBoolean(flagRecord, [flag, normalizedFlag]) ?? false
}

function rowKey(theme: ThemeHealthRow, index: number): string {
  return `${theme.theme}-${theme.etf}-${index}`
}
