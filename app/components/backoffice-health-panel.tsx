import { BackofficeHealthSnapshot, RouteProbe } from '@/lib/backoffice-health'

function statusTone(status: RouteProbe['status']): string {
  if (status === 'reachable') return 'badge completed'
  if (status === 'configured') return 'badge queued'
  if (status === 'missing') return 'badge cancelled'
  return 'badge failed'
}

export function BackofficeHealthPanel({ snapshot }: { snapshot: BackofficeHealthSnapshot }) {
  return (
    <div className="card">
      <div className="split-row">
        <div>
          <h2>Backoffice Health</h2>
          <p className="small">Configuration and reachability checks for the backend, registry, and protected control-plane routes.</p>
        </div>
        <div className="small">
          <div>Admin: {snapshot.adminActor}</div>
          <div>Last check: {new Date(snapshot.checkedAt).toLocaleString()}</div>
        </div>
      </div>

      <div className="metric-grid">
        <StatusCard
          label="Backend API"
          status={snapshot.backendApi.status}
          body={snapshot.backendApi.message}
          footnote={`Base URL: ${snapshot.backendApi.baseUrlConfigured ? 'yes' : 'no'} · Session JWT + backend RBAC`}
        />
        <StatusCard
          label="Registry API"
          status={snapshot.registryApi.status}
          body={snapshot.registryApi.message}
          footnote={`Backend registry integration: ${snapshot.registryApi.configured ? 'enabled' : 'pending'}`}
        />
        <StatusCard
          label="Clerk / Admin"
          status="configured"
          body="Authenticated admin session is active."
          footnote={snapshot.adminActor}
        />
      </div>

      <div className="table-wrap">
        <table className="registry-table">
          <thead>
            <tr>
              <th>Check</th>
              <th>Status</th>
              <th>Route</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.routeChecks.map((probe) => (
              <tr key={probe.label}>
                <td>{probe.label}</td>
                <td><span className={statusTone(probe.status)}>{probe.status}</span></td>
                <td>{probe.method} {probe.path}</td>
                <td>
                  {probe.message}
                  {probe.httpStatus ? <div className="small">HTTP {probe.httpStatus}</div> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatusCard({
  label,
  status,
  body,
  footnote,
}: {
  label: string
  status: RouteProbe['status']
  body: string
  footnote: string
}) {
  return (
    <div className="card compact-card">
      <div className="split-row">
        <label>{label}</label>
        <span className={statusTone(status)}>{status}</span>
      </div>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{body}</div>
      <div className="small">{footnote}</div>
    </div>
  )
}
