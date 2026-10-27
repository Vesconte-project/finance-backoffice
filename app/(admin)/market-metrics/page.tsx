import { requireAdminUser } from '@/lib/admin-auth'
import { MarketMetricsWorkspace } from '@/components/market-metrics/MarketMetricsWorkspace'

export default async function MarketMetricsPage() {
  const admin = await requireAdminUser()
  return <MarketMetricsWorkspace adminActor={admin.userId} />
}
