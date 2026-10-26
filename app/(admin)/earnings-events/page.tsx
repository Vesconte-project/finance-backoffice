import { requireAdminUser } from '@/lib/admin-auth'
import { EarningsEventsWorkspace } from '@/components/earnings-events/EarningsEventsWorkspace'

export default async function EarningsEventsPage() {
  const admin = await requireAdminUser()
  return <EarningsEventsWorkspace adminActor={admin.userId} />
}
