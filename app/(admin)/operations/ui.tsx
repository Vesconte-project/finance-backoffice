import { PREFECT_FALLBACK_UI_URL, type PrefectOverview } from '@/lib/prefect-overview'
import {
  deploymentLastRunLabel,
  deploymentLastStateLabel,
  deploymentNextRunLabel,
  formatPrefectDateTime,
  scheduledRunStateLabel,
} from '@/lib/prefect-labels'

type OperationsWorkspaceProps = {
  adminActor: string
  overview?: PrefectOverview
  loadError?: string
}

export default function OperationsWorkspace({ adminActor, overview, loadError }: OperationsWorkspaceProps) {
  const uiUrl = overview?.uiUrl || PREFECT_FALLBACK_UI_URL

  return (
    <div className="page-stack">
      <div className="card operations-header">
        <div>
          <p className="eyebrow">Operations</p>
          <h1>Prefect overview</h1>
          <p className="small">Admin: {adminActor}</p>
        </div>
        <a className="hero-link operations-primary-link" href={uiUrl} rel="noreferrer" target="_blank">
          Open Prefect UI
        </a>
      </div>

      {loadError ? (
        <div className="error">
          <strong>Prefect overview unavailable</strong>
          <div>{loadError}</div>
          <div className="small">Use the manual Prefect UI link while the backend overview endpoint is unavailable.</div>
        </div>
      ) : null}

      {overview?.errors.length ? (
        <div className="warning operations-warning">
          <strong>Backend warnings</strong>
          <ul className="plain-list">
            {overview.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {overview ? (
        <>
          <div className="operations-summary-grid">
            <Metric label="Work pools" value={overview.workPools.length} />
            <Metric label="Deployments" value={overview.deploymentCount} />
            <Metric label="Scheduled" value={overview.scheduledCount} />
            <Metric label="Recent failures" value={overview.recentFailures.length} tone={overview.recentFailures.length ? 'red' : 'green'} />
          </div>

          <section className="card">
            <SectionHeader title="Work Pools" count={overview.workPools.length} />
            {overview.workPools.length ? (
              <div className="operations-pool-grid">
                {overview.workPools.map((pool) => (
                  <div className="control-kpi-card" key={pool.name}>
                    <label>{pool.name}</label>
                    <div className="operations-status-line">
                      <span className={statusBadgeClass(pool.status)}>{pool.status || 'unknown'}</span>
                      <span className={pool.isPaused ? 'badge running' : 'badge completed'}>
                        {pool.isPaused === null ? 'pause unknown' : pool.isPaused ? 'paused' : 'active'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <EmptyState label="No work pools returned." />}
          </section>

          <section className="card">
            <SectionHeader title="Deployments" count={overview.deployments.length} />
            {overview.deployments.length ? (
              <div className="table-wrap">
                <table className="registry-table operations-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Work pool</th>
                      <th>Next run</th>
                      <th>Last state</th>
                      <th>Last run</th>
                      <th>Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.deployments.map((deployment) => (
                      <tr key={`${deployment.name}-${deployment.workPoolName}`}>
                        <td>
                          <strong>{deployment.displayName || deployment.name}</strong>
                          {deployment.displayName && deployment.displayName !== deployment.name ? <div className="small">{deployment.name}</div> : null}
                        </td>
                        <td>{deployment.workPoolName || 'unknown'}</td>
                        <td>{deploymentNextRunLabel(deployment.nextRunAt, deployment.hasSchedule)}</td>
                        <td><span className={statusBadgeClass(deployment.lastRunState)}>{deploymentLastStateLabel(deployment.lastRunState)}</span></td>
                        <td>{deploymentLastRunLabel(deployment.lastRunAt)}</td>
                        <td><ExternalLink href={deployment.url} label="Open" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState label="No deployments returned." />}
          </section>

          <section className="card">
            <SectionHeader title="Upcoming Scheduled Runs" count={overview.scheduledRuns.length} />
            {overview.scheduledRuns.length ? (
              <div className="table-wrap">
                <table className="registry-table operations-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Deployment</th>
                      <th>Expected start</th>
                      <th>State</th>
                      <th>Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.scheduledRuns.map((run) => (
                      <tr key={`${run.name}-${run.deploymentName}-${run.expectedStartTime}`}>
                        <td>{run.name || 'unnamed run'}</td>
                        <td>{run.deploymentName || 'unknown'}</td>
                        <td>{formatPrefectDateTime(run.expectedStartTime, 'Not scheduled')}</td>
                        <td><span className={statusBadgeClass(scheduledRunStateLabel(run.stateName, run.expectedStartTime))}>{scheduledRunStateLabel(run.stateName, run.expectedStartTime)}</span></td>
                        <td><ExternalLink href={run.url} label="Open" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState label="No scheduled runs returned." />}
          </section>

          <section className="card">
            <SectionHeader title="Recent Failures" count={overview.recentFailures.length} />
            {overview.recentFailures.length ? (
              <div className="feed-list">
                {overview.recentFailures.map((failure, index) => (
                  <div className="feed-row operations-failure-row" key={`${failure.message}-${index}`}>
                    <span className="feed-dot red" />
                    <span>{failure.message || 'Failure without message'}</span>
                    <ExternalLink href={failure.url} label="Open" />
                  </div>
                ))}
              </div>
            ) : <EmptyState label="No recent failures returned." />}
          </section>

          <section className="card">
            <SectionHeader title="Recent Runs" count={overview.recentRuns.length} />
            {overview.recentRuns.length ? (
              <div className="table-wrap">
                <table className="registry-table operations-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Deployment</th>
                      <th>State</th>
                      <th>Started</th>
                      <th>Ended</th>
                      <th>Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.recentRuns.map((run) => (
                      <tr key={`${run.name}-${run.deploymentName}-${run.startTime}`}>
                        <td>{run.name || 'unnamed run'}</td>
                        <td>{run.deploymentName || 'unknown'}</td>
                        <td><span className={statusBadgeClass(run.stateName)}>{run.stateName || 'unknown'}</span></td>
                        <td>{formatPrefectDateTime(run.startTime, 'not started')}</td>
                        <td>{formatPrefectDateTime(run.endTime, 'not finished')}</td>
                        <td><ExternalLink href={run.url} label="Open" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState label="No recent runs returned." />}
          </section>
        </>
      ) : null}
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: 'green' | 'red' }) {
  return (
    <div className="card compact-card">
      <label>{label}</label>
      <div className={tone === 'red' ? 'metric-value text-red' : tone === 'green' ? 'metric-value text-green' : 'metric-value'}>{value}</div>
    </div>
  )
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="split-row">
      <h2>{title}</h2>
      <span className="badge muted">{count}</span>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return <p className="small empty-state">{label}</p>
}

function ExternalLink({ href, label }: { href: string; label: string }) {
  if (!href) return <span className="small">No link</span>
  return <a className="text-link" href={href} rel="noreferrer" target="_blank">{label}</a>
}

function statusBadgeClass(status: string): string {
  const normalized = status.trim().toLowerCase()
  if (['completed', 'complete', 'success', 'ready', 'active', 'healthy'].includes(normalized)) return 'badge completed'
  if (['scheduled', 'pending', 'queued', 'late'].includes(normalized)) return 'badge queued'
  if (['running', 'paused', 'cancelling'].includes(normalized)) return 'badge running'
  if (['failed', 'crashed', 'error', 'unhealthy'].includes(normalized)) return 'badge failed'
  if (['cancelled', 'canceled'].includes(normalized)) return 'badge cancelled'
  return 'badge muted'
}
