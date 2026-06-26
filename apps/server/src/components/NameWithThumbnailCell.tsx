'use client'

import { VolumeUpIcon } from './icons'

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
        <VolumeUpIcon size={36} style={{ flexShrink: 0, opacity: 0.6 }} />
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
