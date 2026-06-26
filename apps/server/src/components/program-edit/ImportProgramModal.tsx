'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import { useState, useEffect, useMemo, type FC } from 'react'
import { CloseIcon } from '../icons'

interface ProgramItem {
  id: number
  title: string
  slides: any[]
}

type ImportProgramModalProps = {
  isOpen: boolean
  onClose: () => void
  onImport: (slides: any[]) => void
}

export const ImportProgramModal: FC<ImportProgramModalProps> = ({ isOpen, onClose, onImport }) => {
  const { id } = useDocumentInfo()
  const [programs, setPrograms] = useState<ProgramItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    setError(null)
    setSearch('')
    fetch('/api/programs?depth=0&limit=50&sort=-updatedAt')
      .then((r) => r.json())
      .then((data) => setPrograms(data.docs || []))
      .catch(() => setError('Failed to load programs'))
      .finally(() => setLoading(false))
  }, [isOpen])

  const filtered = useMemo(() => {
    return programs
      .filter((p) => p.id !== id)
      .filter((p) => !search || (p.title || '').toLowerCase().includes(search.toLowerCase()))
  }, [programs, id, search])

  const handleSelect = (program: ProgramItem) => {
    setImporting(true)
    const validSlides = (program.slides || []).filter(
      (s: any) => s && s.blockType && !String(s.id).startsWith('auto')
    )
    onImport(validSlides)
    setImporting(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 8,
          width: 480,
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--theme-elevation-200, #e5e7eb)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Import Program</span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1.2rem',
              color: 'var(--theme-elevation-400, #9ca3af)',
              lineHeight: 1,
              padding: 0,
            }}
          >
            <CloseIcon size={20} />
          </button>
        </div>

        <div style={{ padding: '12px 20px' }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search programs..."
            autoFocus
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: '0.85rem',
              border: '1px solid var(--theme-elevation-300, #d1d5db)',
              borderRadius: 6,
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 16px', minHeight: 100 }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--theme-elevation-400, #9ca3af)', fontSize: '0.85rem' }}>
              Loading programs...
            </div>
          ) : error ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#ef4444', fontSize: '0.85rem' }}>{error}</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--theme-elevation-400, #9ca3af)', fontSize: '0.85rem' }}>
              {search ? 'No matching programs' : 'No other programs available'}
            </div>
          ) : (
            filtered.map((program) => {
              const slideCount = (program.slides || []).filter(
                (s: any) => s && s.blockType && !String(s.id).startsWith('auto')
              ).length
              return (
                <div
                  key={program.id}
                  onClick={() => !importing && handleSelect(program)}
                  style={{
                    padding: '10px 12px',
                    cursor: importing ? 'wait' : 'pointer',
                    borderBottom: '1px solid var(--theme-elevation-100, #f3f4f6)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderRadius: 4,
                    opacity: importing ? 0.5 : 1,
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--theme-elevation-100, #f3f4f6)'
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent'
                  }}
                >
                  <span style={{ fontSize: '0.85rem' }}>{program.title || '(untitled)'}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--theme-elevation-400, #9ca3af)' }}>
                    {slideCount} slide{slideCount !== 1 ? 's' : ''}
                  </span>
                </div>
              )
            })
          )}
        </div>

        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--theme-elevation-200, #e5e7eb)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px',
              background: 'var(--theme-elevation-100, #f3f4f6)',
              border: '1px solid var(--theme-elevation-300, #d1d5db)',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: '0.8rem',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
