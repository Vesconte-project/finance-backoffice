'use client'

import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import { readApiError } from '@/lib/api-error'
import { requestClientJson } from '@/lib/client-json'
import { unwrapList } from '@/lib/payload'
import { ApiErrorBox, EvidenceGap, JsonBlock, formatUnknown } from '@/app/components/workspace-data'

type JobRow = Record<string, unknown>

export default function DailyInferenceWorkspace() {
  const [date, setDate] = useState('')
  const [environment, setEnvironment] = useState('production')
  const [payload, setPayload] = useState<unknown>(null)
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadJobs() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (date.trim()) params.set('date', date.trim())
      if (environment.trim()) params.set('environment', environment.trim())
      params.set('limit', '200')
      const response = await requestClientJson(`/api/production/daily-inference?${params.toString()}`)
      setPayload(response)
      setJobs(normalizeJobs(response))
    } catch (requestError) {
      setError(readApiError(requestError, 'Failed to load daily inference jobs.'))
    } finally {
      setLoading(false)
    }
  }

  const loadJobsEffect = useEffectEvent(() => {
    void loadJobs()
  })

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadJobsEffect()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const summary = useMemo(() => summarize(jobs), [jobs])

  return (
    <div className="page-stack">
      <ApiErrorBox error={error} />

      <form className="card" onSubmit={(event) => {
        event.preventDefault()
        void loadJobs()
      }}>
        <div className="split-row">
          <div>
            <h2>Filters</h2>
            <p className="small">Blank date lets the backend choose the default window.</p>
          </div>
          <button className="primary" type="submit" disabled={loading}>{loading ? 'Loading...' : 'Refresh jobs'}</button>
        </div>
        <div className="row">
          <div>
            <label htmlFor="inferenceDate">Date</label>
            <input id="inferenceDate" value={date} onChange={(event) => setDate(event.target.value)} placeholder="YYYY-MM-DD" />
          </div>
          <div>
            <label htmlFor="inferenceEnvironment">Environment</label>
            <input id="inferenceEnvironment" value={environment} onChange={(event) => setEnvironment(event.target.value)} placeholder="production" />
          </div>
        </div>
      </form>

      <div className="metric-grid">
        <Metric label="Jobs" value={jobs.length} />
        <Metric label="Succeeded" value={summary.succeeded} />
        <Metric label="Running" value={summary.running} />
        <Metric label="Failed" value={summary.failed} />
      </div>

      <div className="card">
        <div className="split-row">
          <div>
            <h2>Production daily inference jobs</h2>
            <p className="small">Status, dispatch date, worker job ID, errors, and last success are backend fields.</p>
          </div>
          <span className="small">{loading ? 'Refreshing...' : `${jobs.length} jobs`}</span>
        </div>
        {jobs.length === 0 ? (
          <EvidenceGap
            reason="No daily inference jobs were returned for the selected environment/date."
            expected="Rows from /analyst/production/daily-inference once production inference has run."
            title="Daily inference evidence unavailable"
          />
        ) : <JobTable jobs={jobs} />}
      </div>

      <details className="card">
        <summary>Raw daily inference payload</summary>
        <JsonBlock value={payload ?? {}} />
      </details>
    </div>
  )
}

function JobTable({ jobs }: { jobs: JobRow[] }) {
  return (
    <div className="table-wrap">
      <table className="registry-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Pointer / Surface</th>
            <th>Dispatch date</th>
            <th>Worker job</th>
            <th>Last success</th>
            <th>Errors</th>
            <th>Raw</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job, index) => (
            <tr key={`${formatUnknown(job.job_id ?? job.worker_job_id ?? job.id)}-${index}`} className={isFailed(job) ? 'danger-row' : undefined}>
              <td><span className={`badge ${statusClass(job.status)}`}>{formatUnknown(job.status)}</span></td>
              <td>{formatUnknown(job.active_pointer_id ?? job.pointer_id ?? job.strategy_family)}</td>
              <td>{formatUnknown(job.dispatch_date ?? job.date ?? job.as_of_date)}</td>
              <td>{formatUnknown(job.worker_job_id ?? job.job_id ?? job.backend_job_id)}</td>
              <td>{formatUnknown(job.last_success_at ?? job.last_success_date)}</td>
              <td>{formatUnknown(job.error_message ?? job.errors ?? job.error)}</td>
              <td>
                <details>
                  <summary>JSON</summary>
                  <JsonBlock value={job} />
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function normalizeJobs(payload: unknown): JobRow[] {
  return unwrapList<JobRow>(payload, ['jobs', 'daily_inference_jobs', 'items', 'results'])
}

function summarize(jobs: JobRow[]) {
  return jobs.reduce<{ succeeded: number; running: number; failed: number }>((summary, job) => {
    const status = String(job.status ?? '').toLowerCase()
    if (['success', 'succeeded', 'completed', 'done'].includes(status)) summary.succeeded += 1
    if (['running', 'queued', 'dispatching'].includes(status)) summary.running += 1
    if (['failed', 'error', 'blocked'].includes(status)) summary.failed += 1
    return summary
  }, { succeeded: 0, running: 0, failed: 0 })
}

function Metric({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="card compact-card">
      <label>{label}</label>
      <div className="metric-value">{formatUnknown(value)}</div>
    </div>
  )
}

function statusClass(value: unknown): string {
  const status = String(value ?? '').toLowerCase()
  if (['success', 'succeeded', 'completed', 'done'].includes(status)) return 'completed'
  if (['failed', 'error', 'blocked'].includes(status)) return 'failed'
  if (['running', 'queued', 'dispatching'].includes(status)) return 'running'
  return 'queued'
}

function isFailed(job: JobRow): boolean {
  return statusClass(job.status) === 'failed'
}
