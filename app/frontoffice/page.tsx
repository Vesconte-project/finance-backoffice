import { requireAdminUser } from '@/lib/admin-auth'
import FrontofficeWorkspace from './ui'

export default async function FrontofficePage() {
  const admin = await requireAdminUser()
  return <FrontofficeWorkspace adminActor={admin.userId} />
}
