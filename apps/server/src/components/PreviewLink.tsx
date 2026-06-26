'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import { PlayArrowIcon } from './icons'

export function PreviewLink() {
  const { id } = useDocumentInfo()

  if (!id) return null

  return (
    <div style={{ padding: '16px 0' }}>
      <a
        href={`/preview/${id}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 16px',
          background: 'var(--theme-elevation-800, #1a1a1a)',
          color: 'var(--theme-elevation-100, #e0e0e0)',
          border: '1px solid var(--theme-elevation-400, #444)',
          borderRadius: '4px',
          textDecoration: 'none',
          fontSize: '0.875rem',
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        <PlayArrowIcon size={16} />
        Open Program Preview
      </a>
    </div>
  )
}
