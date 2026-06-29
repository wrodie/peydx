'use client'

import { RemoteControlView } from '@/components/RemoteControlView'
import { TopNavHeader } from '@/components/TopNavHeader'

export default function RemoteControlPage() {
  return (
    <>
      <TopNavHeader />
      <div className="remote-page-content" style={{ fontFamily: 'system-ui' }}>
        <RemoteControlView />
      </div>
    </>
  )
}
