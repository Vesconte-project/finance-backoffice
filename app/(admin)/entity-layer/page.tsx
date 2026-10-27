import { EntityLayerWorkspace } from '@/components/entity-layer/EntityLayerWorkspace'
import { requireAdminUser } from '@/lib/admin-auth'

export default async function EntityLayerPage() {
  const admin = await requireAdminUser()

  return <EntityLayerWorkspace adminActor={admin.userId} />
}
