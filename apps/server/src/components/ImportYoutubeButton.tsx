'use client'

export function ImportYoutubeButton() {
  const handleClick = async () => {
    const url = window.prompt('Enter YouTube URL or Video ID:')
    if (!url) return

    try {
      const res = await fetch('/api/import-youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Import failed')
      }

      window.location.reload()
    } catch (err: any) {
      alert('Failed to import YouTube video:\n' + err.message)
    }
  }

  return (
    <button
      onClick={handleClick}
      style={{
        padding: '6px 14px',
        background: 'var(--theme-elevation-100)',
        border: '1px solid var(--theme-elevation-250)',
        borderRadius: 4,
        cursor: 'pointer',
        fontSize: 13,
        whiteSpace: 'nowrap',
      }}
    >
      Import from YouTube
    </button>
  )
}
