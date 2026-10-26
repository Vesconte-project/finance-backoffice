import { DataControlWorkspace } from '@/components/data-control/DataControlWorkspace'
import { requireAdminUser } from '@/lib/admin-auth'

export default async function DataControlPage() {
  const admin = await requireAdminUser()
  return <DataControlWorkspace adminActor={admin.userId} />
}
