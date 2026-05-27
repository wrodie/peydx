'use client'

import { useDocumentInfo } from '@payloadcms/ui'

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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
        Open Program Preview
      </a>
    </div>
  )
}
