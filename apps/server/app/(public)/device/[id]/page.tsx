import { getPayload } from 'payload'
import config from '@payload-config'
import { importMap } from '../../../(payload)/admin/importMap'
import { BrowserPlayer } from './BrowserPlayer'

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
      <html>
        <head><title>Device Not Found</title></head>
        <body style={{ fontFamily: 'system-ui', padding: 40, background: '#111', color: '#eee' }}>
          <h1>Device Not Found</h1>
          <p>The requested device does not exist or is not a browser device.</p>
        </body>
      </html>
    )
  }

  if (!token || device.browserToken !== token) {
    return (
      <html>
        <head><title>Invalid Token</title></head>
        <body style={{ fontFamily: 'system-ui', padding: 40, background: '#111', color: '#eee' }}>
          <h1>Invalid Token</h1>
          <p>The provided token is invalid. Please use the correct URL from the admin panel.</p>
        </body>
      </html>
    )
  }

  return (
    <html>
      <head>
        <title>Signage - {device.name}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body style={{ margin: 0, background: 'black', overflow: 'hidden' }}>
        <BrowserPlayer id={id} token={token as string} />
      </body>
    </html>
  )
}
