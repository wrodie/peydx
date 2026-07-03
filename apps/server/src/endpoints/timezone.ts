function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export const timezone = {
  path: '/timezone',
  method: 'get' as const,
  handler: async () => {
    const raw = process.env.TIMEZONE || 'UTC'
    const tz = isValidTimezone(raw) ? raw : 'UTC'
    return Response.json({ timezone: tz })
  },
}
