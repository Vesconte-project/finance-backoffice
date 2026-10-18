'use client'

import { useEffect, useMemo, useState } from 'react'
import { requestClientJson } from '@/lib/client-json'

type DataDomain = 'market' | 'fundamentals' | 'earnings' | 'macro' | 'release-calendar'
type InventoryStatus = 'ok' | 'missing' | 'unknown' | string
type DayStatus = 'ok' | 'missing' | 'not_expected' | 'partial' | 'unknown' | string

type InventoryItem = {
  domain: DataDomain
  table: string
  entity_key: string
  entity_type: string
  first_available_date?: string | null
  latest_available_date?: string | null
  latest_updated_at?: string | null
  row_count: number
  frequency?: string | null
  expected_calendar: string
  status: InventoryStatus
  missing_ranges_count: number
  reason?: string | null
}

type InventoryResponse = {
  generated_at?: string | null
  items: InventoryItem[]
  unsupported?: Array<{ domain: string; reason: string }>
}

type CoverageDay = {
  date: string
  status: DayStatus
  count: number
  expected: boolean
  reason?: string | null
}

type MissingRange = {
  start_date: string
  end_date: string
  missing_days: number
}

type CoverageResponse = {
  generated_at?: string | null
  domain: DataDomain
  table: string
  entity_key: string
  entity_type: string
  start_date: string
  end_date: string
  expected_calendar: string
  summary: {
    expected_days: number
    covered_days: number
    missing_days: number
    not_expected_days: number
    unknown_days: number
    coverage_pct: number | null
    denominator_label: string
    status: string
    reason?: string | null
  }
  days: CoverageDay[]
  missing_ranges: MissingRange[]
  period_gaps?: Array<{
    after_date: string
    before_date: string
    gap_days: number
    missing_estimate: number
  }>
  period_summary?: {
    count: number
    first_date: string
    last_date: string
    gap_count: number
  } | null
}

type Props = {
  adminActor: string
  initialDomain?: string
  initialEntity?: string
  initialMonth: string
}

const DOMAINS: Array<{ value: 'all' | DataDomain; label: string }> = [
  { value: 'all', label: 'All domains' },
  { value: 'market', label: 'Market' },
  { value: 'macro', label: 'Macro' },
  { value: 'release-calendar', label: 'Release calendar' },
  { value: 'fundamentals', label: 'Fundamentals' },
  { value: 'earnings', label: 'Earnings' },
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'missing', label: 'Missing' },
  { value: 'unknown', label: 'Unknown' },
  { value: 'ok', label: 'Healthy' },
]

export default function DataWorkspace({ adminActor, initialDomain, initialEntity, initialMonth }: Props) {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [unsupported, setUnsupported] = useState<Array<{ domain: string; reason: string }>>([])
  const [inventoryLoading, setInventoryLoading] = useState(true)
  const [inventoryError, setInventoryError] = useState<unknown>(null)
  const [selected, setSelected] = useState<InventoryItem | null>(null)
  const [coverage, setCoverage] = useState<CoverageResponse | null>(null)
  const [coverageLoading, setCoverageLoading] = useState(false)
  const [coverageError, setCoverageError] = useState<unknown>(null)
  const [domainFilter, setDomainFilter] = useState<'all' | DataDomain>(normalizeDomain(initialDomain) ?? 'all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState(initialEntity ?? '')
  const [month, setMonth] = useState(validMonth(initialMonth) ? initialMonth : toMonthIso(new Date()))
  const [selectedDay, setSelectedDay] = useState<CoverageDay | null>(null)
  const [repairState, setRepairState] = useState<'idle' | 'submitting' | 'submitted' | 'failed'>('idle')
  const [repairError, setRepairError] = useState<unknown>(null)

  useEffect(() => {
    let cancelled = false

    async function loadInventory() {
      setInventoryLoading(true)
      setInventoryError(null)
      try {
        const payload = await requestClientJson('/api/data-ops/inventory?limit=250') as InventoryResponse
        if (cancelled) return
        const items = Array.isArray(payload.items) ? payload.items : []
        setInventory(items)
        setUnsupported(Array.isArray(payload.unsupported) ? payload.unsupported : [])
        setSelected((current) => current ?? selectInitialItem(items, initialDomain, initialEntity))
      } catch (error) {
        if (!cancelled) setInventoryError(error)
      } finally {
        if (!cancelled) setInventoryLoading(false)
      }
    }

    void loadInventory()
    return () => {
      cancelled = true
    }
  }, [initialDomain, initialEntity])

  useEffect(() => {
    if (!selected) return
    const activeSelection = selected

    let cancelled = false
    async function loadCoverage() {
      setCoverageLoading(true)
      setCoverageError(null)
      setSelectedDay(null)
      setRepairState('idle')
      setRepairError(null)
      try {
        const { startDate, endDate } = monthBounds(month)
        const query = new URLSearchParams({
          domain: activeSelection.domain,
          entity_key: activeSelection.entity_key,
          start_date: startDate,
          end_date: endDate,
        })
        const payload = await requestClientJson(`/api/data-ops/coverage?${query.toString()}`) as CoverageResponse
        if (!cancelled) setCoverage(payload)
      } catch (error) {
        if (!cancelled) {
          setCoverage(null)
          setCoverageError(error)
        }
      } finally {
        if (!cancelled) setCoverageLoading(false)
      }
    }

    writeUrlState(activeSelection, month)
    void loadCoverage()
    return () => {
      cancelled = true
    }
  }, [selected, month])

  const filteredInventory = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return inventory.filter((item) => {
      if (domainFilter !== 'all' && item.domain !== domainFilter) return false
      if (statusFilter !== 'all' && item.status !== statusFilter) return false
      if (!needle) return true
      return [
        item.domain,
        item.entity_key,
        item.entity_type,
        item.table,
        item.expected_calendar,
        item.reason ?? '',
      ].some((value) => String(value).toLowerCase().includes(needle))
    })
  }, [inventory, domainFilter, statusFilter, search])

  const brokenCount = inventory.filter((item) => item.status === 'missing').length
  const unknownCount = inventory.filter((item) => item.status === 'unknown').length
  const visibleCoverage = selected && coverageMatchesSelectionAndMonth(coverage, selected, month) ? coverage : null

  return (
    <div className="page-stack">
      <div className="card">
        <div className="split-row">
          <div>
            <h1>Data</h1>
            <p className="small">Inventory-first view of available datasets, entity date ranges, strict month coverage, and contextual repairs.</p>
          </div>
          <div className="small">Admin: {adminActor}</div>
        </div>
      </div>

      {inventoryError ? <ContractError endpoint="/analyst/data-ops/inventory" error={inventoryError} /> : null}
      {unsupported.length > 0 ? (
        <div className="alert warning">
          Some domains could not be inspected: {unsupported.map((item) => `${item.domain}: ${item.reason}`).join('; ')}
        </div>
      ) : null}

      <div className="metric-grid">
        <KpiCard label="Entities sampled" value={inventoryLoading ? '...' : String(inventory.length)} sub="Loaded from fast data-ops inventory" />
        <KpiCard label="Flagged in inventory" value={inventoryLoading ? '...' : String(brokenCount)} sub="Only cheap inventory-level signals" />
        <KpiCard label="Needs coverage check" value={inventoryLoading ? '...' : String(unknownCount)} sub="Select an entity for exact gaps" />
      </div>

      <div className="data-workspace-grid">
        <section className="card inventory-panel">
          <div className="split-row">
            <div>
              <h2>Inventory</h2>
              <p className="small">Pick one dataset/entity. Coverage and calendar are scoped only to that selection.</p>
            </div>
          </div>

          <div className="data-filter-bar">
            <div>
              <label htmlFor="dataDomain">Domain</label>
              <select id="dataDomain" value={domainFilter} onChange={(event) => setDomainFilter(event.target.value as 'all' | DataDomain)}>
                {DOMAINS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="dataStatus">Status</label>
              <select id="dataStatus" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="dataSearch">Entity search</label>
              <input id="dataSearch" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="SPY, ICSA, CPI..." />
            </div>
          </div>

          <div className="data-inventory-list">
            {inventoryLoading ? <div className="empty-state">Loading inventory...</div> : null}
            {!inventoryLoading && filteredInventory.length === 0 ? <div className="empty-state">No inventory rows match the current filters.</div> : null}
            {filteredInventory.map((item) => (
              <button
                className={selected && selected.domain === item.domain && selected.entity_key === item.entity_key ? 'inventory-row selected' : 'inventory-row'}
                key={`${item.domain}-${item.entity_key}`}
                onClick={() => setSelected(item)}
                type="button"
              >
                <span>
                  <strong>{item.entity_key}</strong>
                  <span className="small">{item.domain} / {item.entity_type}</span>
                </span>
                <span className="inventory-range">
                  <span>{formatRange(item.first_available_date, item.latest_available_date)}</span>
                  <span className="small">{item.row_count} sampled rows</span>
                </span>
                <span className={`badge ${badgeClass(item.status)}`}>{statusLabel(item.status)}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="card detail-panel">
          {selected ? (
            <>
              <div className="split-row">
                <div>
                  <p className="eyebrow">{selected.domain}</p>
                  <h2>{selected.domain} / {selected.entity_key}</h2>
                  <p className="small">
                    Available {formatRange(selected.first_available_date, selected.latest_available_date)}. Calendar: {selected.expected_calendar}.
                  </p>
                </div>
                <span className={`badge ${badgeClass(selected.status)}`}>{statusLabel(selected.status)}</span>
              </div>

              <div className="month-toolbar">
                <button className="secondary" type="button" onClick={() => setMonth(shiftMonth(month, -1))}>Previous</button>
                <div>
                  <label htmlFor="coverageMonth">Coverage month</label>
                  <input id="coverageMonth" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
                </div>
                <button className="secondary" type="button" onClick={() => setMonth(shiftMonth(month, 1))}>Next</button>
              </div>

              {coverageError ? <ContractError endpoint="/analyst/data-ops/coverage" error={coverageError} /> : null}

              {isEventDomain(selected.domain) ? (
                <EventCoverageView coverage={visibleCoverage} loading={coverageLoading} />
              ) : (
                <>
                  <CoverageSummary coverage={visibleCoverage} loading={coverageLoading} />
                  <MonthCalendar coverage={visibleCoverage} loading={coverageLoading} month={month} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
                  {isDailyScanDomain(selected.domain) ? (
                    <GapScanPanel key={`${selected.domain}-${selected.entity_key}`} selected={selected} />
                  ) : null}
                  <RepairDrawer
                    coverage={visibleCoverage}
                    selected={selected}
                    selectedDay={selectedDay}
                    repairError={repairError}
                    repairState={repairState}
                    onClose={() => setSelectedDay(null)}
                    onDryRun={() => void submitDryRunRepair(selected, selectedDay, visibleCoverage, setRepairState, setRepairError)}
                  />
                </>
              )}
            </>
          ) : (
            <div className="empty-state">Select an inventory row to inspect month coverage.</div>
          )}
        </section>
      </div>
    </div>
  )
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card compact-card">
      <label>{label}</label>
      <div className="metric-value">{value}</div>
      <div className="small">{sub}</div>
    </div>
  )
}

function CoverageSummary({ coverage, loading }: { coverage: CoverageResponse | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="coverage-summary loading" aria-label="Loading month coverage">
        <div>
          <label>Coverage</label>
          <span className="coverage-skeleton wide" />
          <span className="coverage-skeleton line" />
        </div>
        <div>
          <label>Missing</label>
          <span className="coverage-skeleton wide" />
          <span className="coverage-skeleton line" />
        </div>
        <div>
          <label>Status</label>
          <span className="coverage-skeleton wide" />
          <span className="coverage-skeleton line" />
        </div>
      </div>
    )
  }
  if (!coverage) return <div className="coverage-summary">Coverage has not loaded.</div>
  const pct = coverage.summary.coverage_pct === null ? 'Unknown' : `${coverage.summary.coverage_pct}%`
  return (
    <div className="coverage-summary">
      <div>
        <label>Coverage</label>
        <strong>{pct}</strong>
        <span className="small">{coverage.summary.covered_days} / {coverage.summary.expected_days} {coverage.summary.denominator_label}</span>
      </div>
      <div>
        <label>Missing</label>
        <strong>{coverage.summary.missing_days}</strong>
        <span className="small">{coverage.missing_ranges.length} range(s)</span>
      </div>
      <div>
        <label>Status</label>
        <strong>{statusLabel(coverage.summary.status)}</strong>
        <span className="small">{coverage.summary.reason ?? coverage.expected_calendar}</span>
      </div>
    </div>
  )
}

function EventCoverageView({ coverage, loading }: { coverage: CoverageResponse | null; loading: boolean }) {
  if (loading) return <div className="coverage-summary loading">Loading period coverage...</div>
  if (!coverage) return <div className="coverage-summary">Coverage has not loaded.</div>

  const summary = coverage.period_summary ?? null
  const gaps = coverage.period_gaps ?? []

  return (
    <div className="coverage-summary" style={{ display: 'block' }}>
      <p className="small">
        Event-based dataset (quarterly periods) - coverage is shown by period, not by calendar day.
      </p>
      {summary ? (
        <p>
          <strong>{summary.count}</strong> periods on record | {summary.first_date} to {summary.last_date} |{' '}
          <strong>{summary.gap_count}</strong> probable gap(s)
        </p>
      ) : (
        <p className="small">No periods on record for this entity.</p>
      )}
      {gaps.length > 0 ? (
        <div className="table-wrap">
          <table className="registry-table">
            <thead>
              <tr>
                <th>After</th>
                <th>Before</th>
                <th>Gap (days)</th>
                <th>~Missing periods</th>
              </tr>
            </thead>
            <tbody>
              {gaps.map((gap) => (
                <tr key={`${gap.after_date}-${gap.before_date}`}>
                  <td>{gap.after_date}</td>
                  <td>{gap.before_date}</td>
                  <td>{gap.gap_days}</td>
                  <td>{gap.missing_estimate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="small">No suspicious gaps detected between consecutive periods.</p>
      )}
    </div>
  )
}

function GapScanPanel({ selected }: { selected: { domain: string; entity_key: string } }) {
  const [scan, setScan] = useState<CoverageResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function runScan() {
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams({ domain: selected.domain, entity_key: selected.entity_key })
      const payload = await requestClientJson(`/api/data-ops/coverage-gaps?${query.toString()}`) as CoverageResponse
      setScan(payload)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="coverage-summary" style={{ display: 'block' }}>
      <button className="secondary" type="button" onClick={() => void runScan()} disabled={loading}>
        {loading ? 'Scanning full history...' : 'Scan full history for gaps'}
      </button>
      {error ? <ContractError endpoint="/analyst/data-ops/coverage-gaps" error={error} /> : null}
      {scan ? (
        <>
          <p className="small">
            Scanned {scan.start_date || '-'} to {scan.end_date} |{' '}
            {scan.summary.coverage_pct === null ? 'Unknown' : `${scan.summary.coverage_pct}%`} covered |{' '}
            <strong>{scan.missing_ranges.length}</strong> gap(s)
          </p>
          {scan.missing_ranges.length > 0 ? (
            <div className="table-wrap">
              <table className="registry-table">
                <thead>
                  <tr>
                    <th>From</th>
                    <th>To</th>
                    <th>Missing days</th>
                  </tr>
                </thead>
                <tbody>
                  {scan.missing_ranges.map((range) => (
                    <tr key={`${range.start_date}-${range.end_date}`}>
                      <td>{range.start_date}</td>
                      <td>{range.end_date}</td>
                      <td>{range.missing_days}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="small">No gaps found across full history.</p>
          )}
        </>
      ) : null}
    </div>
  )
}

function MonthCalendar({
  coverage,
  loading,
  month,
  selectedDay,
  onSelectDay,
}: {
  coverage: CoverageResponse | null
  loading: boolean
  month: string
  selectedDay: CoverageDay | null
  onSelectDay: (day: CoverageDay) => void
}) {
  const days = coverage?.days ?? buildEmptyMonthDays(month)
  const leadingBlanks = leadingBlankCount(month)
  return (
    <div className="single-calendar">
      <div className="calendar-header">
        <span className="calendar-title">{monthLabel(month)}</span>
        <div className="calendar-legend">
          <Legend swatch="ok" label="Present" />
          <Legend swatch="missing" label="Missing" />
          <Legend swatch="not-expected" label="Not expected" />
          <Legend swatch="unknown" label="Unknown" />
        </div>
      </div>
      <div className="calendar-weekdays">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <div key={day}>{day}</div>)}
      </div>
      <div className="calendar-grid">
        {Array.from({ length: leadingBlanks }).map((_, index) => <div aria-hidden="true" className="calendar-blank" key={`blank-${index}`} />)}
        {loading ? (
          days.map((day) => (
            <button
              className="calendar-day loading"
              disabled
              key={day.date}
              type="button"
            >
              <span>{new Date(`${day.date}T00:00:00`).getDate()}</span>
              <small />
            </button>
          ))
        ) : (
          days.map((day) => (
            <button
              className={`calendar-day ${calendarStatusClass(day.status)} ${selectedDay?.date === day.date ? 'selected' : ''}`}
              key={day.date}
              onClick={() => onSelectDay(day)}
              type="button"
            >
              <span>{new Date(`${day.date}T00:00:00`).getDate()}</span>
              <small>{day.count ? `${day.count}` : ''}</small>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

function RepairDrawer({
  coverage,
  selected,
  selectedDay,
  repairError,
  repairState,
  onClose,
  onDryRun,
}: {
  coverage: CoverageResponse | null
  selected: InventoryItem
  selectedDay: CoverageDay | null
  repairError: unknown
  repairState: string
  onClose: () => void
  onDryRun: () => void
}) {
  if (!selectedDay) return null
  const range = coverage?.missing_ranges.find((item) => selectedDay.date >= item.start_date && selectedDay.date <= item.end_date)
  const repairable = selectedDay.status === 'missing'
  return (
    <div className="repair-drawer">
      <div className="split-row">
        <div>
          <h3>{selected.entity_key} on {selectedDay.date}</h3>
          <p className="small">{selected.domain} / {selected.entity_type}</p>
        </div>
        <button className="secondary" type="button" onClick={onClose}>Close</button>
      </div>
      <div className="details-grid">
        <Field label="Day status" value={statusLabel(selectedDay.status)} />
        <Field label="Rows" value={String(selectedDay.count)} />
        <Field label="Expected" value={selectedDay.expected ? 'Yes' : 'No'} />
        <Field label="Reason" value={selectedDay.reason ?? 'No issue reported.'} />
        {range ? <Field label="Missing range" value={`${range.start_date} to ${range.end_date} (${range.missing_days} day(s))`} /> : null}
      </div>
      {repairError ? <ContractError endpoint="/api/data-ops/rebuild-jobs" error={repairError} /> : null}
      <div className="drawer-actions">
        <button className="primary" type="button" disabled={!repairable || repairState === 'submitting'} onClick={onDryRun}>
          {repairState === 'submitting' ? 'Submitting dry run...' : repairState === 'submitted' ? 'Dry run submitted' : 'Run repair dry run'}
        </button>
        {!repairable ? <span className="small">Repair is only available for missing expected days.</span> : null}
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label>{label}</label>
      <div className="field-value">{value}</div>
    </div>
  )
}

async function submitDryRunRepair(
  selected: InventoryItem,
  selectedDay: CoverageDay | null,
  coverage: CoverageResponse | null,
  setRepairState: (state: 'idle' | 'submitting' | 'submitted' | 'failed') => void,
  setRepairError: (error: unknown) => void
) {
  if (!selectedDay || selectedDay.status !== 'missing') return
  setRepairState('submitting')
  setRepairError(null)
  const range = coverage?.missing_ranges.find((item) => selectedDay.date >= item.start_date && selectedDay.date <= item.end_date)
  const startDate = range?.start_date ?? selectedDay.date
  const endDate = range?.end_date ?? selectedDay.date
  try {
    await requestClientJson('/api/data-ops/rebuild-jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain: selected.domain,
        mode: 'rebuild_missing_only',
        dry_run: true,
        confirm_phrase: null,
        requested_scope_label: `${selected.domain} / ${selected.entity_key} / ${startDate} to ${endDate}`,
        scope: selected.entity_type === 'ticker'
          ? { scope_type: 'ticker', ticker: selected.entity_key, start_date: startDate, end_date: endDate }
          : { scope_type: 'series_key', series_key: selected.entity_key, start_date: startDate, end_date: endDate },
      }),
    })
    setRepairState('submitted')
  } catch (error) {
    setRepairError(error)
    setRepairState('failed')
  }
}

function ContractError({ endpoint, error }: { endpoint: string; error: unknown }) {
  const payload = isRecord(error) ? error : {}
  const status = payload.statusCode ?? payload.upstreamStatus ?? 'unknown'
  const message = payload.message ?? (error instanceof Error ? error.message : 'The data-ops contract is unavailable.')
  return (
    <div className="alert error">
      <strong>Data Ops contract unavailable</strong>
      <div>{endpoint} returned status {String(status)}.</div>
      <div>{String(message)}</div>
      {typeof payload.upstreamBodyPreview === 'string' && payload.upstreamBodyPreview ? <pre>{payload.upstreamBodyPreview}</pre> : null}
    </div>
  )
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span>
      <span className={`calendar-swatch ${swatch}`} />
      {label}
    </span>
  )
}

function selectInitialItem(items: InventoryItem[], initialDomain?: string, initialEntity?: string): InventoryItem | null {
  if (initialDomain && initialEntity) {
    const match = items.find((item) => item.domain === initialDomain && item.entity_key.toLowerCase() === initialEntity.toLowerCase())
    if (match) return match
  }
  return (
    items.find((item) => item.domain === 'market' && item.entity_key === 'SPY') ??
    items.find((item) => item.domain === 'market') ??
    items.find((item) => item.status === 'missing') ??
    items[0] ??
    null
  )
}

function coverageMatchesSelectionAndMonth(coverage: CoverageResponse | null, selected: InventoryItem, month: string): coverage is CoverageResponse {
  if (!coverage) return false
  const { startDate, endDate } = monthBounds(month)
  return (
    coverage.domain === selected.domain &&
    coverage.entity_key === selected.entity_key &&
    coverage.start_date === startDate &&
    coverage.end_date === endDate
  )
}

function isEventDomain(domain: string): boolean {
  return domain === 'fundamentals' || domain === 'earnings'
}

function isDailyScanDomain(domain: string): boolean {
  return domain === 'market' || domain === 'macro'
}

function normalizeDomain(value?: string): DataDomain | null {
  return DOMAINS.some((item) => item.value === value && value !== 'all') ? value as DataDomain : null
}

function writeUrlState(selected: InventoryItem, month: string) {
  const params = new URLSearchParams({
    domain: selected.domain,
    entity: selected.entity_key,
    month,
  })
  window.history.replaceState(null, '', `/data?${params.toString()}`)
}

function monthBounds(month: string): { startDate: string; endDate: string } {
  const [yearRaw, monthRaw] = month.split('-')
  const year = Number(yearRaw)
  const monthIndex = Number(monthRaw) - 1
  const start = new Date(Date.UTC(year, monthIndex, 1))
  const end = new Date(Date.UTC(year, monthIndex + 1, 0))
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }
}

function buildEmptyMonthDays(month: string): CoverageDay[] {
  const { startDate, endDate } = monthBounds(month)
  const days: CoverageDay[] = []
  const cursor = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  while (cursor <= end) {
    days.push({ date: cursor.toISOString().slice(0, 10), status: 'unknown', count: 0, expected: false, reason: 'Coverage has not loaded.' })
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

function leadingBlankCount(month: string): number {
  const { startDate } = monthBounds(month)
  return (new Date(`${startDate}T00:00:00`).getDay() + 6) % 7
}

function shiftMonth(month: string, delta: number): string {
  const [yearRaw, monthRaw] = month.split('-')
  const date = new Date(Date.UTC(Number(yearRaw), Number(monthRaw) - 1 + delta, 1))
  return toMonthIso(date)
}

function toMonthIso(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function validMonth(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value)
}

function monthLabel(month: string): string {
  const [yearRaw, monthRaw] = month.split('-')
  return new Date(Date.UTC(Number(yearRaw), Number(monthRaw) - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

function formatRange(start?: string | null, end?: string | null): string {
  if (!start && !end) return 'No dated rows'
  if (start === end) return start ?? end ?? '-'
  return `${start ?? '?'} to ${end ?? '?'}`
}

function badgeClass(status: string): string {
  if (status === 'ok') return 'completed'
  if (status === 'missing') return 'failed'
  if (status === 'partial') return 'running'
  return 'queued'
}

function statusLabel(status: string): string {
  if (status === 'ok') return 'Healthy'
  if (status === 'missing') return 'Missing'
  if (status === 'not_expected') return 'Not expected'
  if (status === 'unknown') return 'Unknown'
  if (status === 'partial') return 'Partial'
  if (status === 'empty') return 'Empty'
  return status
}

function calendarStatusClass(status: string): string {
  if (status === 'ok') return 'ok'
  if (status === 'missing') return 'missing'
  if (status === 'partial') return 'partial'
  if (status === 'not_expected') return 'not-expected'
  return 'unknown'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
