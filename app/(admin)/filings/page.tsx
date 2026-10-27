import { requireAdminUser } from '@/lib/admin-auth'
import { FilingsWorkspace } from '@/components/filings/FilingsWorkspace'

export default async function FilingsPage() {
  const admin = await requireAdminUser()
  return <FilingsWorkspace adminActor={admin.userId} />
}
