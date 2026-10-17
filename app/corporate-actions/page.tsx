import { requireAdminUser } from '@/lib/admin-auth'
import { CorporateActionsWorkspace } from '@/components/corporate-actions/CorporateActionsWorkspace'

export default async function CorporateActionsPage() {
  const admin = await requireAdminUser()
  return <CorporateActionsWorkspace adminActor={admin.userId} />
}
