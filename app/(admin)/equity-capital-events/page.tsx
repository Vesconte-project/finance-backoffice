import { EquityCapitalEventsWorkspace } from '@/components/equity-capital-events/EquityCapitalEventsWorkspace'
import { requireAdminUser } from '@/lib/admin-auth'

export default async function EquityCapitalEventsPage() {
  const admin = await requireAdminUser()
  return <EquityCapitalEventsWorkspace adminActor={admin.userId} />
}
