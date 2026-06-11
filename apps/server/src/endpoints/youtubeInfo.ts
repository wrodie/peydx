export const youtubeInfo = {
  path: '/youtube-info',
  method: 'post' as const,
  handler: async (req: any) => {
    let body: { videoId?: string } = {}
    try {
      body = await req.clone().json()
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const videoId = body.videoId
    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return Response.json({ error: 'Invalid video ID' }, { status: 400 })
    }

    try {
      const res = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
        { signal: AbortSignal.timeout(5000) }
      )
      if (!res.ok) {
        return Response.json({ error: 'YouTube API error' }, { status: 502 })
      }
      const data = await res.json()
      return Response.json({ title: data.title || null })
    } catch {
      return Response.json({ error: 'Failed to fetch video info' }, { status: 502 })
    }
  },
}
