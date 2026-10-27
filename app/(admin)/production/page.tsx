import { requireAdminUser } from '@/lib/admin-auth'
import { requestBackendJson } from '@/lib/backend-client'

export default async function ProductionPage() {
  await requireAdminUser()
  let pointers: Record<string, unknown>[] = []
  let available = false
  try {
    const { payload } = await requestBackendJson({ path: '/analyst/registry/active-pointers',
      searchParams: new URLSearchParams({ environment: 'production' }) })
    const rows = payload && typeof payload === 'object' && 'active_pointers' in payload ? payload.active_pointers : null
    if (Array.isArray(rows) && rows.every(row => row && typeof row === 'object' && row.environment === 'production')) {
      pointers = rows; available = true
    }
  } catch { available = false }
  return <section className="card">
    <h1>Production</h1>
    {!available ? <p>Production data is unavailable.</p> : pointers.length === 0 ? <p>No production pointers.</p> :
      <table><thead><tr><th>Strategy</th><th>Universe</th><th>Active model</th></tr></thead>
        <tbody>{pointers.map((row, index) => <tr key={String(row.active_pointer_id ?? index)}>
          <td>{String(row.strategy_family ?? '')}</td><td>{String(row.universe ?? '')}</td>
          <td>{String(row.active_candidate_id ?? row.candidate_id ?? '')}</td></tr>)}</tbody></table>}
    <p>Candidate and readiness views are unavailable until the registry records ownership and explicit submission.</p>
  </section>
}
