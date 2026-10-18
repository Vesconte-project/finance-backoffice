import { RelationshipMapHealthWorkspace } from '@/components/relationship-map/RelationshipMapHealthWorkspace'
import { requireAdminUser } from '@/lib/admin-auth'

export default async function RelationshipMapPage() {
  const admin = await requireAdminUser()

  return <RelationshipMapHealthWorkspace adminActor={admin.userId} />
}
