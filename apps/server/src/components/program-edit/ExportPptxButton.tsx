'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import { useState, type FC } from 'react'

export const ExportPptxButton: FC = () => {
  const { id } = useDocumentInfo()
  const [exporting, setExporting] = useState(false)

  if (!id) return null

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch(`/api/export-pptx/${id}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Export failed' }))
        alert(err.error || 'Export failed')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const disposition = res.headers.get('Content-Disposition')
      const match = disposition?.match(/filename\*?=(?:UTF-8'')?([^;\n]+)/i)
      a.download = match ? match[1].replace(/"/g, '') : 'program.pptx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      alert('Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      style={{
        padding: '6px 14px',
        background: 'transparent',
        color: 'var(--theme-success-600, #16a34a)',
        border: '1px solid var(--theme-success-600, #16a34a)',
        borderRadius: 4,
        cursor: exporting ? 'wait' : 'pointer',
        fontSize: '0.8rem',
        fontWeight: 500,
        opacity: exporting ? 0.6 : 1,
      }}
    >
      {exporting ? 'Exporting...' : 'Export as PPTX'}
    </button>
  )
}
