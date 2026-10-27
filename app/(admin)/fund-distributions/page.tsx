import { FundDistributionsWorkspace } from '@/components/fund-distributions/FundDistributionsWorkspace'
import { requireAdminUser } from '@/lib/admin-auth'

export default async function FundDistributionsPage() {
  const admin = await requireAdminUser()
  return <FundDistributionsWorkspace adminActor={admin.userId} />
}
