import { FundRebalancesWorkspace } from '@/components/fund-rebalances/FundRebalancesWorkspace'
import { requireAdminUser } from '@/lib/admin-auth'

export default async function FundRebalancesPage() {
  const admin = await requireAdminUser()
  return <FundRebalancesWorkspace adminActor={admin.userId} />
}
