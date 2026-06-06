'use client'

export function NameWithThumbnailCell({
  rowData,
  cellData,
  link,
  linkURL,
  collectionSlug,
}: {
  rowData: any
  cellData: string
  link?: boolean
  linkURL?: string
  collectionSlug?: string
}) {
  const thumbUrl = rowData?.sizes?.thumbnail?.url || rowData?.url
  const isAudio = rowData?.mimeType?.startsWith('audio')
  const content = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {isAudio ? (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          style={{ width: 36, height: 36, flexShrink: 0, opacity: 0.6 }}
        >
          <path d="M3 9v6h4l5 5V4L7 9H3zM16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
        </svg>
      ) : thumbUrl && (
        <img src={thumbUrl} alt="" style={{ width: 60, height: 36, objectFit: 'cover', flexShrink: 0 }} />
      )}
      <span>{cellData}</span>
    </div>
  )
  if (link && rowData?.id) {
    return (
      <a
        href={linkURL || `/admin/collections/${collectionSlug || 'media'}/${rowData.id}`}
        style={{ textDecoration: 'none', color: 'var(--theme-primary-500, #3b82f6)', fontWeight: 500 }}
      >
        {content}
      </a>
    )
  }
  return content
}
