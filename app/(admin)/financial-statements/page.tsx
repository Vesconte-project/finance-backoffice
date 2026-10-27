import { requireAdminUser } from '@/lib/admin-auth'
import { FinancialStatementsWorkspace } from '@/components/financial-statements/FinancialStatementsWorkspace'

export default async function FinancialStatementsPage() {
  const admin = await requireAdminUser()
  return <FinancialStatementsWorkspace adminActor={admin.userId} />
}
