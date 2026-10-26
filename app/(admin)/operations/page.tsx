import { requireAdminUser } from '@/lib/admin-auth'
import { toBackendProxyErrorPayload } from '@/lib/backend-client'
import { loadPrefectOverview } from '@/lib/prefect-overview'
import OperationsWorkspace from './ui'

export default async function OperationsPage() {
  const admin = await requireAdminUser()
  let overview = undefined
  let loadError = undefined

  try {
    overview = await loadPrefectOverview()
  } catch (error) {
    const payload = toBackendProxyErrorPayload(error)
    loadError = payload.message
  }

  return <OperationsWorkspace adminActor={admin.userId} overview={overview} loadError={loadError} />
}
