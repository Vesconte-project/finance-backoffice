'use client'

import { FormEvent, useEffect, useState } from 'react'
import { readApiError } from '@/lib/api-error'
import { requestClientJson } from '@/lib/client-json'
import { ApiErrorBox, DynamicTable, EvidenceGap, JsonBlock, asRecord, readArrayPayload, readString } from '@/app/components/workspace-data'

const RUN_COLUMNS = [
  { key: 'id', label: 'Run ID', keys: ['id', 'runId', 'run_id'] },
  { key: 'ticker', label: 'Ticker' },
  { key: 'question', label: 'Question' },
  { key: 'promptLabel', label: 'Prompt', keys: ['promptLabel', 'prompt_label'] },
  { key: 'signalDirection', label: 'Signal Direction', keys: ['signalDirection', 'signal_direction'] },
  { key: 'conviction', label: 'Conviction' },
  { key: 'predictionHorizon', label: 'Horizon', keys: ['predictionHorizon', 'prediction_horizon'] },
  { key: 'status', label: 'Status' },
  { key: 'provider', label: 'Provider' },
  { key: 'model', label: 'Model' },
  { key: 'citations', label: 'Citations' },
  { key: 'completedAt', label: 'Completed At', keys: ['completedAt', 'completed_at'] },
]

const MISSING_ADMIN_CONTRACTS = [
  'no admin all-users research run list',
  'no user search/list',
  'no usage/rate summary',
  'no moderation controls',
  'no frontoffice research dashboard endpoint',
  'no alert delivery dashboard',
  'no analytics summary endpoint',
]

export default function FrontofficeWorkspace({ adminEmail }: { adminEmail: string }) {
  const [userId, setUserId] = useState('')
  const [ticker, setTicker] = useState('')
  const [runId, setRunId] = useState('')
  const [userWatchlist, setUserWatchlist] = useState<string[]>([])
  const [runs, setRuns] = useState<unknown[]>([])
  const [runDetail, setRunDetail] = useState<unknown | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'ai' | 'user'>(() => initialFrontofficeTab())

  async function loadUserLookup() {
    const normalizedUserId = userId.trim()
    if (!normalizedUserId) {
      setLookupError('This endpoint requires user_id; admin all-user view is not exposed yet.')
      return
    }

    setLookupLoading(true)
    setLookupError(null)
    try {
      const params = new URLSearchParams()
      params.set('user_id', normalizedUserId)
      const watchlistPayload = await requestClientJson(`/api/frontoffice/watchlist?${params.toString()}`)
      setUserWatchlist(readArrayPayload(watchlistPayload, 'tickers').map((value) => String(value).trim().toUpperCase()).filter(Boolean))

      const runParams = new URLSearchParams()
      runParams.set('user_id', normalizedUserId)
      runParams.set('limit', '20')
      if (ticker.trim()) runParams.set('ticker', ticker.trim().toUpperCase())
      const runsPayload = await requestClientJson(`/api/frontoffice/ai-research/runs?${runParams.toString()}`)
      setRuns(readArrayPayload(runsPayload, 'runs'))
    } catch (err) {
      setLookupError(readApiError(err, 'Failed to load user frontoffice research data.'))
    } finally {
      setLookupLoading(false)
    }
  }

  async function loadRunDetail() {
    const normalizedUserId = userId.trim()
    const normalizedRunId = runId.trim()
    if (!normalizedUserId || !normalizedRunId) {
      setDetailError('Run detail lookup requires both user_id and run id.')
      return
    }

    setDetailLoading(true)
    setDetailError(null)
    try {
      const payload = await requestClientJson(`/api/frontoffice/ai-research/runs/${encodeURIComponent(normalizedRunId)}?user_id=${encodeURIComponent(normalizedUserId)}`)
      setRunDetail(asRecord(payload)?.run ?? payload)
    } catch (err) {
      setDetailError(readApiError(err, 'Failed to load AI research run detail.'))
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    function syncHashTab() {
      setActiveTab(window.location.hash === '#user-models' ? 'user' : 'ai')
    }
    syncHashTab()
    window.addEventListener('hashchange', syncHashTab)
    return () => window.removeEventListener('hashchange', syncHashTab)
  }, [])

  function onUserSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void loadUserLookup()
  }

  function onDetailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void loadRunDetail()
  }

  return (
    <div className="page-stack">
      <div className="card">
        <div>
          <h1>Frontoffice</h1>
          <p className="small">Inspect frontoffice AI research runs now; reserve user-built model administration for the future contract.</p>
        </div>
        <div className="split-row" style={{ marginTop: 12 }}>
          <div className="chart-tabs" role="tablist" aria-label="Frontoffice tabs">
            <button className={activeTab === 'ai' ? 'primary' : 'secondary'} onClick={() => setActiveTab('ai')} type="button">AI research</button>
            <button className={activeTab === 'user' ? 'primary' : 'secondary'} onClick={() => setActiveTab('user')} type="button">User models</button>
          </div>
          <div className="small">Admin: {adminEmail}</div>
        </div>
      </div>

      {activeTab === 'user' ? (
        <div className="card" id="user-models">
          <h2>User models</h2>
          <EvidenceGap
            reason="User-built model administration is reserved in the IA, but the backend does not expose user candidate sources or all-user admin model contracts yet."
            expected="A user candidate source on /analyst/signal-evaluation/candidates and all-user frontoffice admin contracts."
            title="Coming soon"
          />
        </div>
      ) : (
        <>
      <form className="card" onSubmit={onUserSubmit}>
        <h2>User Lookup</h2>
        <p className="small">Existing backend contracts require user_id for user-specific watchlist and AI research run visibility.</p>
        <div className="row">
          <div>
            <label>User ID</label>
            <input value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="frontoffice user id" />
          </div>
          <div>
            <label>Ticker filter</label>
            <input value={ticker} onChange={(event) => setTicker(event.target.value)} placeholder="optional, e.g. SPY" />
          </div>
        </div>
        <div className="admin-action-row">
          <button className="primary" type="submit" disabled={lookupLoading}>{lookupLoading ? 'Loading...' : 'Load user activity'}</button>
        </div>
        <ApiErrorBox error={lookupError} />
      </form>

      <div className="feature-grid">
        <div className="card compact-card">
          <h2>Selected User Watchlist</h2>
          {userWatchlist.length > 0 ? (
            <div className="meta">
              {userWatchlist.map((item) => (
                <span className="badge queued" key={item}>{item}</span>
              ))}
            </div>
          ) : (
            <EvidenceGap reason="No rows were returned for this user watchlist lookup." expected="Rows from /site/watchlist?user_id=..." title="User watchlist unavailable" />
          )}
        </div>
        <div className="card compact-card">
          <h2>Run Detail Lookup</h2>
          <form onSubmit={onDetailSubmit}>
            <label>Run ID</label>
            <input value={runId} onChange={(event) => setRunId(event.target.value)} placeholder="AI research run id" />
            <div className="admin-action-row">
              <button className="secondary" type="submit" disabled={detailLoading}>{detailLoading ? 'Loading...' : 'Load run detail'}</button>
            </div>
          </form>
          <ApiErrorBox error={detailError} />
        </div>
      </div>

      <div className="card">
        <h2>Recent AI Research Runs</h2>
        <p className="small">Backend: GET /site/ai-research/runs?user_id=... Fields are rendered if returned; raw JSON is preserved per row.</p>
        {runs.length > 0 ? (
          <DynamicTable rows={runs.map(addDerivedRunFields)} columns={RUN_COLUMNS} />
        ) : (
          <EvidenceGap reason="No AI research runs were returned for this user lookup." expected="Rows from /site/ai-research/runs?user_id=..." title="AI research runs unavailable" />
        )}
      </div>

      <div className="card">
        <h2>Run Detail</h2>
        {runDetail ? (
          <>
            <div className="field-grid">
              <div>
                <label>Ticker</label>
                <div>{readString(runDetail, ['ticker'])}</div>
              </div>
              <div>
                <label>Status</label>
                <div>{readString(runDetail, ['status'])}</div>
              </div>
              <div>
                <label>Provider / Model</label>
                <div>{readString(runDetail, ['provider'])} / {readString(runDetail, ['model'])}</div>
              </div>
            </div>
            <details className="details-block" open>
              <summary>Raw run detail</summary>
              <JsonBlock value={runDetail} />
            </details>
          </>
        ) : (
          <EvidenceGap reason="No run detail has been loaded yet." expected="Provide user_id and run id for /site/ai-research/runs/{run_id}." title="Run detail unavailable" />
        )}
      </div>

      <div className="card">
        <h2>Missing Admin Contracts</h2>
        <EvidenceGap
          reason="These backend contracts block a complete all-user frontoffice control surface."
          expected="All-user admin runs, user model candidates, user search/list, usage/rate, moderation, alert delivery, and analytics summary contracts."
        />
        <ul className="plain-list">
          {MISSING_ADMIN_CONTRACTS.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
      </div>
        </>
      )}
    </div>
  )
}

function addDerivedRunFields(row: unknown): unknown {
  const record = asRecord(row)
  if (!record) return row
  const citations = record.citations
  return {
    ...record,
    citations: Array.isArray(citations) ? citations.length : citations,
  }
}

function initialFrontofficeTab(): 'ai' | 'user' {
  if (typeof window === 'undefined') return 'ai'
  return window.location.hash === '#user-models' ? 'user' : 'ai'
}
