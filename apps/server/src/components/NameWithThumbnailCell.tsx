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
  const content = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {thumbUrl && (
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
