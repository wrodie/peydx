'use client'

export function ThumbnailOnlyCell({ rowData, cellData }: { rowData: any; cellData: string }) {
  const url = rowData?.sizes?.thumbnail?.url || rowData?.url
  if (!url) return <span style={{ color: '#999' }}>{cellData}</span>
  return (
    <img
      src={url}
      alt=""
      style={{ width: 60, height: 36, objectFit: 'cover', display: 'block' }}
    />
  )
}
