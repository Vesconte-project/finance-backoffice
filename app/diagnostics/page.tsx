import { BackofficeHealthPanel } from '@/app/components/backoffice-health-panel'
import { requireAdminUser } from '@/lib/admin-auth'
import { loadBackofficeHealth } from '@/lib/backoffice-health'

const RAW_ROUTE_GUIDE = [
  '/api/research/capabilities',
  '/api/data-ops/health',
  '/api/data-ops/rebuild-jobs',
]

export default async function DiagnosticsPage() {
  const admin = await requireAdminUser()
  const health = await loadBackofficeHealth(admin.userId)

  return (
    <div className="page-stack">
      <BackofficeHealthPanel snapshot={health} />

      <div className="card">
        <h2>Diagnostics</h2>
        <p className="small">Use this area for connectivity checks, protected route smoke tests, and raw debug entry points. It is intentionally separate from Research Lab and Data Quality.</p>
      </div>

      <div className="feature-grid">
        <div className="card compact-card">
          <h3>Raw API / Debug Tools</h3>
          <p className="small">These routes stay behind admin auth and now return JSON diagnostics instead of crashing on HTML error pages.</p>
          <ul className="plain-list">
            {RAW_ROUTE_GUIDE.map((route) => (
              <li key={route}>{route}</li>
            ))}
          </ul>
        </div>

        <div className="card compact-card">
          <h3>Queue / Worker Status</h3>
          <p className="small">No explicit worker or queue health endpoint is exposed by `finance-backend` yet. Route-level reachability is shown above; deeper worker status requires backend support.</p>
        </div>
      </div>
    </div>
  )
}
