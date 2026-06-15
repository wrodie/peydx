import { createHmac } from 'crypto'

const TTL_SECONDS = 3600

export function generateMediaToken(filename: string, secret: string): string {
  const expiresAt = Math.floor(Date.now() / 1000) + TTL_SECONDS
  const payload = `${filename}:${expiresAt}`
  const signature = createHmac('sha256', secret).update(payload).digest('hex')
  return `${expiresAt}.${signature}`
}

export function verifyMediaToken(
  token: string,
  filename: string,
  secret: string,
): boolean {
  const parts = token.split('.')
  if (parts.length !== 2) return false
  const [expiresAt, signature] = parts
  const expected = createHmac('sha256', secret)
    .update(`${filename}:${expiresAt}`)
    .digest('hex')
  if (signature !== expected) return false
  return parseInt(expiresAt, 10) > Math.floor(Date.now() / 1000)
}
