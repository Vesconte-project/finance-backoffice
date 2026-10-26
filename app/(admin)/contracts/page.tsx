import Link from 'next/link'
import { requireAdminUser } from '@/lib/admin-auth'
import { fetchBackendContract } from '@/lib/backend-contract'
import { toBackendProxyErrorPayload } from '@/lib/backend-client'

const MISSING_CONTRACTS = [
  'official signal active model/candidate lineage',
  'official signal forward evaluation',
  'paper/shadow signal candidates',
  'candidate-vs-official comparison',
  'decay/replacement proposals',
  'admin all-user AI research runs',
  'user research activity summary',
  'queue depth',
  'worker heartbeat',
  'campaign preview/create/detail',
  'registry pending authorization actions',
  'registry mutation approval workflow',
  'data-ops issue drilldown/repair preview',
]

const SIGNAL_EVALUATION_REQUIRED_CONTRACTS = [
  ['normalized comparison summary', 'available', 'backend', '/evaluation', 'Signal Evaluation V1 normalizes candidate summaries, metrics, sources metadata, links, and structured gaps.'],
  ['selected candidate report', 'available', 'backend', '/evaluation', 'Signal Evaluation V1 report endpoint returns metrics, robustness, lineage, readiness, artifacts, raw evidence, series containers, and gaps.'],
  ['IC series', 'V1 gap-backed', 'backend / research orchestrator', '/evaluation', 'V1 returns series containers and backend gaps; it does not compute/populate IC points.'],
  ['rolling IC series', 'V1 gap-backed', 'backend / research orchestrator', '/evaluation', 'V1 returns structured gaps for rolling IC series.'],
  ['forward returns by signal date/horizon', 'V1 gap-backed', 'backend', '/evaluation', 'V1 does not compute candidate/model forward-return time series.'],
  ['cumulative return/equity curve', 'backend-supported when configured', 'research orchestrator / backend', '/evaluation', 'Signal Evaluation Series V1 can populate report.series.equity_curve.points when artifact roots/readers are configured; otherwise it returns artifact_reader_disabled or related gaps.'],
  ['drawdown series', 'backend-supported when configured', 'research orchestrator / backend', '/evaluation', 'Signal Evaluation Series V1 can populate report.series.drawdown.points when artifact roots/readers are configured; otherwise it returns artifact_reader_disabled or related gaps.'],
  ['turnover series', 'backend-supported when configured', 'backend / strategy lab', '/evaluation', 'Signal Evaluation Series V1 can populate report.series.turnover.points when artifact roots/readers are configured; otherwise it returns artifact_reader_disabled or related gaps.'],
  ['confidence calibration', 'V1 gap-backed', 'backend / ML lab', '/evaluation', 'V1 returns structured gaps for confidence calibration.'],
  ['regime breakdown', 'V1 gap-backed', 'backend / research orchestrator', '/evaluation', 'V1 returns structured gaps for regime breakdown.'],
  ['decay/live-vs-backtest divergence', 'V1 gap-backed', 'backend / future', '/evaluation', 'V1 returns structured gaps for decay/live-vs-backtest divergence.'],
  ['official active model/candidate lineage', 'partial', 'registry / backend', '/evaluation', 'V1 can include active-pointer evidence when available, but live signal history is not fully linked to official lineage.'],
  ['paper/shadow candidate signal stream', 'missing', 'backend / future', '/evaluation', 'No paper/shadow signal stream exists.'],
  ['candidate-vs-official disagreement performance', 'V1 gap-backed', 'backend / future', '/evaluation', 'V1 returns structured gaps; no disagreement-performance series is computed.'],
  ['launch signal test/model experiment', 'partial', 'backend / research orchestrator', '/evaluation, /research', 'Single research experiment creation exists; dynamic signal-test launch is not standardized.'],
  ['campaign/model-template catalog', 'missing', 'backend / future', '/evaluation, /research', 'No template catalog or campaign expansion contract exists.'],
]

export default async function ContractsPage() {
  const admin = await requireAdminUser()
  const contractResult = await loadBackendContract()
  const backofficeOperations = contractResult.contract?.operations.filter((operation) => operation.consumers.includes('backoffice')) ?? []

  return (
    <div className="page-stack">
      <div className="hero-panel">
        <div>
          <p className="eyebrow">Backend Contract Inventory</p>
          <h1>See the live backend operations available to Backoffice and what still needs backend support.</h1>
          <p className="hero-copy">
            The operation inventory is loaded from finance-backend. Product requirements that have no backend contract remain separately identified as gaps.
          </p>
        </div>
        <div className="hero-actions">
          <div className="small">Admin: {admin.userId}</div>
          <Link className="hero-link" href="/diagnostics">Open Diagnostics</Link>
        </div>
      </div>

      <div className="card">
        <h2>Why This Exists</h2>
        <p className="small">
          Operators and developers need one place to see the live backend contract, its authentication boundary, lifecycle owner, and intended consumers. This page does not create backend capabilities.
        </p>
      </div>

      <div className="card">
        <h2>Live Backend Operations</h2>
        {contractResult.contract ? (
          <>
            <p className="small">Contract {contractResult.contract.contract_version} | API {contractResult.contract.api_version} | {backofficeOperations.length} operations intended for Backoffice out of {contractResult.contract.operation_count} total.</p>
            <div className="table-wrap">
              <table className="registry-table">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Route</th>
                    <th>Audience</th>
                    <th>Auth</th>
                    <th>Owner</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {backofficeOperations.map((operation) => (
                    <tr key={`${operation.method}-${operation.path}`}>
                      <td>{operation.method}</td>
                      <td title={operation.auth_notes}>{operation.path}</td>
                      <td>{operation.audience}</td>
                      <td>{operation.auth}</td>
                      <td>{operation.owner}</td>
                      <td><span className={operation.status === 'stable' ? 'badge completed' : 'badge running'}>{operation.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="small">Backend contract manifest is unavailable: {contractResult.error}</p>
        )}
      </div>

      <div className="card">
        <h2>Signal Evaluation Required Contracts</h2>
        <p className="small">These contracts define what the Signal Evaluation Lab needs to compare many candidates/models and render model-quality evidence without fake metrics.</p>
        <div className="table-wrap">
          <table className="registry-table">
            <thead>
              <tr>
                <th>Contract</th>
                <th>Current status</th>
                <th>Expected owner</th>
                <th>Needed by</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {SIGNAL_EVALUATION_REQUIRED_CONTRACTS.map(([contract, status, owner, page, notes]) => (
                <tr key={contract}>
                  <td>{contract}</td>
                  <td><span className={contractStatusClass(status)}>{status}</span></td>
                  <td>{owner}</td>
                  <td>{page}</td>
                  <td>{notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Missing Contracts</h2>
        <p className="small">These are product requirements that still need finance-backend support before Backoffice can operate them as real control surfaces.</p>
        <ul className="plain-list">
          {MISSING_CONTRACTS.map((contract) => (
            <li key={contract}>{contract}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

async function loadBackendContract(): Promise<{ contract: Awaited<ReturnType<typeof fetchBackendContract>> | null; error: string | null }> {
  try {
    return { contract: await fetchBackendContract(), error: null }
  } catch (error) {
    return { contract: null, error: toBackendProxyErrorPayload(error).message }
  }
}

function contractStatusClass(status: string): string {
  if (status === 'available') return 'badge completed'
  if (status === 'partial' || status === 'artifact-only' || status === 'V1 gap-backed' || status === 'backend-supported when configured') return 'badge running'
  return 'badge backend-gap'
}
