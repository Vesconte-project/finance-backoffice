'use client'

import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import { readApiError } from '@/lib/api-error'
import { requestClientJson } from '@/lib/client-json'
import { asRecord, unwrapList, unwrapRecord } from '@/lib/payload'
import { ApiErrorBox, EvidenceGap, JsonBlock, formatUnknown } from '@/app/components/workspace-data'

type SignalRow = Record<string, unknown>

export default function CrossSectionalSignalsWorkspace() {
  const [universe, setUniverse] = useState('')
  const [date, setDate] = useState('')
  const [payload, setPayload] = useState<unknown>(null)
  const [rows, setRows] = useState<SignalRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadPanel(nextUniverse = universe, nextDate = date) {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (nextUniverse.trim()) params.set('universe', nextUniverse.trim())
      if (nextDate.trim()) params.set('date', nextDate.trim())
      if (!nextDate.trim()) params.set('latest', 'true')
      params.set('active_production', 'true')
      const response = await requestClientJson(`/api/signals/cross-sectional?${params.toString()}`)
      setPayload(response)
      setRows(normalizeRows(response))
    } catch (requestError) {
      setError(readApiError(requestError, 'Failed to load cross-sectional signals.'))
    } finally {
      setLoading(false)
    }
  }

  const loadPanelEffect = useEffectEvent(() => {
    void loadPanel()
  })

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadPanelEffect()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const sortedRows = useMemo(() => [...rows].sort((a, b) => readNumber(a, ['rank']) - readNumber(b, ['rank'])), [rows])
  const meta = asRecord(payload)

  return (
    <div className="page-stack">
      <ApiErrorBox error={error} />

      <form className="card" onSubmit={(event) => {
        event.preventDefault()
        void loadPanel()
      }}>
        <div className="split-row">
          <div>
            <h2>Panel filters</h2>
            <p className="small">Blank date loads the latest panel for the active production pointer.</p>
          </div>
          <button className="primary" type="submit" disabled={loading}>{loading ? 'Loading...' : 'Load panel'}</button>
        </div>
        <div className="row">
          <div>
            <label htmlFor="crossUniverse">Universe</label>
            <input id="crossUniverse" value={universe} onChange={(event) => setUniverse(event.target.value)} placeholder="SP500" />
          </div>
          <div>
            <label htmlFor="crossDate">Date</label>
            <input id="crossDate" value={date} onChange={(event) => setDate(event.target.value)} placeholder="YYYY-MM-DD" />
          </div>
        </div>
      </form>

      <div className="metric-grid">
        <Metric label="Rows" value={rows.length} />
        <Metric label="Panel date" value={meta?.panel_date ?? meta?.date ?? meta?.as_of_date} />
        <Metric label="Universe" value={meta?.universe ?? universe} />
        <Metric label="Model version" value={meta?.model_version ?? meta?.active_model_version ?? meta?.active_pointer_version} />
      </div>

      <div className="card">
        <div className="split-row">
          <div>
            <h2>Daily ranked panel</h2>
            <p className="small">Top-K rows are highlighted when the backend marks selected/top_k or rank position.</p>
          </div>
          <span className="small">{loading ? 'Refreshing...' : `${rows.length} rows`}</span>
        </div>
        {sortedRows.length === 0 ? (
          <EvidenceGap
            reason="No ranked panel rows were returned for active_production=true."
            expected="An active production pointer and cross-sectional signal rows from /signals/cross-sectional."
            title="No production panel evidence"
          />
        ) : <SignalTable rows={sortedRows} />}
      </div>

      <details className="card">
        <summary>Raw cross-sectional payload</summary>
        <JsonBlock value={payload ?? {}} />
      </details>
    </div>
  )
}

function SignalTable({ rows }: { rows: SignalRow[] }) {
  return (
    <div className="table-wrap">
      <table className="registry-table">
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Score</th>
            <th>Rank</th>
            <th>Percentile</th>
            <th>Selected</th>
            <th>Horizon</th>
            <th>Model version</th>
            <th>Raw</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const selected = isSelected(row)
            return (
              <tr key={`${readText(row, ['ticker', 'symbol'])}-${index}`} className={selected ? 'highlight-row' : undefined}>
                <td><strong>{readText(row, ['ticker', 'symbol', 'asset'])}</strong></td>
                <td>{formatNumber(readMaybeNumber(row, ['score', 'signal_score', 'prediction_score']))}</td>
                <td>{formatUnknown(row.rank ?? row.cross_sectional_rank)}</td>
                <td>{formatNumber(readMaybeNumber(row, ['percentile', 'rank_percentile']))}</td>
                <td>{selected ? <span className="badge completed">top-K</span> : <span className="small">—</span>}</td>
                <td>{formatUnknown(row.horizon)}</td>
                <td>{formatUnknown(row.model_version ?? row.active_model_version ?? row.bundle_version)}</td>
                <td>
                  <details>
                    <summary>JSON</summary>
                    <JsonBlock value={row} />
                  </details>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function normalizeRows(payload: unknown): SignalRow[] {
  const direct = unwrapList<SignalRow>(payload, ['rows', 'signals', 'panel', 'items', 'results'])
  if (direct.length > 0) return direct
  const nested = unwrapRecord(payload, ['panel'])
  return unwrapList<SignalRow>(nested, ['rows'])
}

function Metric({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="card compact-card">
      <label>{label}</label>
      <div className="metric-value">{formatUnknown(value)}</div>
    </div>
  )
}

function isSelected(row: SignalRow): boolean {
  if (row.selected === true || row.top_k === true || row.is_top_k === true) return true
  const rank = readMaybeNumber(row, ['rank', 'cross_sectional_rank'])
  const topK = readMaybeNumber(row, ['top_k_cutoff', 'k'])
  return rank !== null && topK !== null && rank <= topK
}

function readText(row: SignalRow, keys: string[]): string {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  }
  return '—'
}

function readMaybeNumber(row: SignalRow, keys: string[]): number | null {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function readNumber(row: SignalRow, keys: string[]): number {
  return readMaybeNumber(row, keys) ?? Number.MAX_SAFE_INTEGER
}

function formatNumber(value: number | null): string {
  if (value === null) return '—'
  return Math.abs(value) >= 100 ? value.toFixed(1) : value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
}
