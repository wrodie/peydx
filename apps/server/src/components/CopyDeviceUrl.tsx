'use client'

import { useDocumentInfo, useField } from '@payloadcms/ui'
import { useCallback } from 'react'

const buttonStyle: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: '0.8rem',
  border: '1px solid var(--theme-elevation-200, #ddd)',
  borderRadius: 4,
  cursor: 'pointer',
  background: 'var(--theme-elevation-50, #f8f8f8)',
}

export function CopyDeviceUrl() {
  const { id } = useDocumentInfo()
  const { value: deviceType } = useField<string>({ path: 'deviceType' })
  const { value: browserToken } = useField<string>({ path: 'browserToken' })

  if (deviceType !== 'browser' || !id) return null

  const url = `${window.location.origin}/device/${id}?token=${browserToken}`

  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(url)
  }, [url])

  const openInNewTab = useCallback(() => {
    window.open(url, '_blank')
  }, [url])

  return (
    <div style={{ padding: '12px 0' }}>
      <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--theme-elevation-500, #666)', marginBottom: 4, display: 'block' }}>
        Browser URL
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
        <input
          type="text"
          readOnly
          value={url}
          style={{
            flex: 1,
            fontSize: '0.8rem',
            padding: '4px 8px',
            border: '1px solid var(--theme-elevation-200, #ddd)',
            borderRadius: 4,
            background: 'var(--theme-elevation-100, #f0f0f0)',
          }}
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" style={buttonStyle} onClick={copyToClipboard}>
          Copy URL
        </button>
        <button type="button" style={buttonStyle} onClick={openInNewTab}>
          Open in New Tab
        </button>
      </div>
    </div>
  )
}
