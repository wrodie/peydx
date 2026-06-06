'use client'

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  if (m > 0) return `${m}:${String(s).padStart(2, '0')}`
  return `0:${String(s).padStart(2, '0')}`
}

export function DurationCell({ cellData }: { cellData: number }) {
  if (cellData == null) return <span style={{ color: '#888' }}>—</span>
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatDuration(cellData)}</span>
}
