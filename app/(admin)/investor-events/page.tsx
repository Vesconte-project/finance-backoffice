import { InvestorEventsWorkspace } from '@/components/investor-events/InvestorEventsWorkspace'
import { requireAdminUser } from '@/lib/admin-auth'

export default async function InvestorEventsPage() {
  const admin = await requireAdminUser()
  return <InvestorEventsWorkspace adminActor={admin.userId} />
}
