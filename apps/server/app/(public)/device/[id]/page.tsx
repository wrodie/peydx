import { getPayload } from 'payload'
import config from '@payload-config'
import { importMap } from '../../../(payload)/admin/importMap'
import { BrowserPlayer } from './BrowserPlayer'
import type { Metadata, Viewport } from 'next'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const payload = await getPayload({ config, importMap })
  const result = await payload.find({
    collection: 'devices',
    where: { id: { equals: parseInt(id) } },
    depth: 0,
    limit: 1,
  })
  const device = result.docs[0]
  return {
    title: device?.name ? `Signage - ${device.name}` : 'Signage',
  }
}

export default async function DevicePlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { id } = await params
  const { token } = await searchParams

  const payload = await getPayload({ config, importMap })

  const result = await payload.find({
    collection: 'devices',
    where: { id: { equals: parseInt(id) } },
    depth: 0,
    limit: 1,
  })

  const device = result.docs[0]

  if (!device || device.deviceType !== 'browser') {
    return (
      <div style={{ fontFamily: 'system-ui', padding: 40, background: '#111', color: '#eee', minHeight: '100vh' }}>
        <h1>Device Not Found</h1>
        <p>The requested device does not exist or is not a browser device.</p>
      </div>
    )
  }

  if (!token || device.browserToken !== token) {
    return (
      <div style={{ fontFamily: 'system-ui', padding: 40, background: '#111', color: '#eee', minHeight: '100vh' }}>
        <h1>Invalid Token</h1>
        <p>The provided token is invalid. Please use the correct URL from the admin panel.</p>
      </div>
    )
  }

  return <BrowserPlayer id={id} token={token as string} />
}
