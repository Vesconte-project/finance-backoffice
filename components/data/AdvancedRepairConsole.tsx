'use client'

import { useState } from 'react'
import DataOpsConsole from '@/app/data-ops/ui'

type Props = {
  adminActor: string
  initialDomain?: string
}

export default function AdvancedRepairConsole({ adminActor, initialDomain }: Props) {
  const [open, setOpen] = useState(Boolean(initialDomain))

  return (
    <details
      className="card"
      onToggle={(event) => setOpen(event.currentTarget.open)}
      open={open}
    >
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Advanced repair console</summary>
      {open ? (
        <div style={{ marginTop: 16 }}>
          <DataOpsConsole adminActor={adminActor} initialDomain={initialDomain} />
        </div>
      ) : null}
    </details>
  )
}
