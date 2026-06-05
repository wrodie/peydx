'use client'

export function FormattedFilesizeCell({ cellData }: { cellData: number }) {
  if (cellData == null) return null
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(cellData) / Math.log(1024))
  const val = (cellData / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)
  return <span style={{ whiteSpace: 'nowrap' }}>{val} {sizes[i]}</span>
}
