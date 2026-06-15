export const timezone = {
  path: '/timezone',
  method: 'get' as const,
  handler: async () => {
    return Response.json({ timezone: process.env.TIMEZONE || 'UTC' })
  },
}
