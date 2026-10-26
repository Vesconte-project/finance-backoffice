import { GuidanceWorkspace } from '@/components/guidance/GuidanceWorkspace'
import { requireAdminUser } from '@/lib/admin-auth'

export default async function GuidancePage() {
  const admin = await requireAdminUser()
  return <GuidanceWorkspace adminActor={admin.userId} />
}
