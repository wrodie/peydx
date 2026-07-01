'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from './icons'
import { useListDrawerContext } from '@payloadcms/ui'

type ModalState =
  | { status: 'idle' }
  | { status: 'input' }
  | { status: 'downloading' }
  | { status: 'error'; message: string }

export function ImportYoutubeButton() {
  const [modal, setModal] = useState<ModalState>({ status: 'idle' })
  const [url, setUrl] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { isInDrawer } = useListDrawerContext()
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!isInDrawer) {
      const el = document.querySelector('.list-header__title-actions')
      if (el instanceof HTMLElement) setPortalTarget(el)
    }
  }, [isInDrawer])

  useEffect(() => {
    if (modal.status === 'input') {
      inputRef.current?.focus()
    }
  }, [modal.status])

  const handleSubmit = async () => {
    if (!url.trim()) return
    setModal({ status: 'downloading' })

    try {
      const res = await fetch('/api/import-youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: url.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setModal({ status: 'error', message: data.error || 'Import failed' })
        return
      }

      window.location.reload()
    } catch (err: any) {
      setModal({ status: 'error', message: err.message })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && modal.status === 'input') {
      handleSubmit()
    }
    if (e.key === 'Escape') {
      setModal({ status: 'idle' })
    }
  }

  const triggerButton = (
    <button
      type="button"
      className="btn btn--style-pill btn--size-small"
      onClick={() => setModal({ status: 'input' })}
      style={{ whiteSpace: 'nowrap' }}
    >
      Import from YouTube
    </button>
  )

  return (
    <>
      {modal.status !== 'idle' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.4)',
          }}
          onClick={() => setModal({ status: 'idle' })}
          onKeyDown={handleKeyDown}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--theme-bg)',
              borderRadius: 8,
              padding: 24,
              width: 420,
              maxWidth: '90vw',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}
          >
            {modal.status === 'input' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Import from YouTube</h3>
                  <button
                    onClick={() => setModal({ status: 'idle' })}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 20, color: 'var(--theme-elevation-500)', padding: 0, lineHeight: 1,
                    }}
                  >
                    <CloseIcon size={20} />
                  </button>
                </div>
                <input
                  ref={inputRef}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Paste YouTube URL or Video ID"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '10px 12px', fontSize: 14,
                    border: '1px solid var(--theme-elevation-250)',
                    borderRadius: 4,
                    background: 'var(--theme-input-bg)',
                    color: 'var(--theme-text)',
                    outline: 'none', marginBottom: 16,
                  }}
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setModal({ status: 'idle' })}
                    style={{
                      padding: '8px 16px', fontSize: 13, borderRadius: 4,
                      border: '1px solid var(--theme-elevation-250)',
                      background: 'var(--theme-elevation-50)',
                      color: 'var(--theme-text)', cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!url.trim()}
                    style={{
                      padding: '8px 16px', fontSize: 13, borderRadius: 4,
                      border: 'none',
                      background: !url.trim() ? 'var(--theme-elevation-150)' : 'var(--theme-elevation-800)',
                      color: !url.trim() ? 'var(--theme-elevation-400)' : 'var(--theme-elevation-0)',
                      cursor: !url.trim() ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Import
                  </button>
                </div>
              </>
            )}

            {modal.status === 'downloading' && (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div
                  style={{
                    width: 32, height: 32,
                    border: '3px solid var(--theme-elevation-200)',
                    borderTopColor: 'var(--theme-elevation-800)',
                    borderRadius: '50%',
                    margin: '0 auto 16px',
                    animation: 'yt-spin 0.8s linear infinite',
                  }}
                />
                <style>{`@keyframes yt-spin { to { transform: rotate(360deg) } }`}</style>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>
                  Downloading your video...
                </p>
                <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--theme-elevation-500)' }}>
                  This may take a minute
                </p>
              </div>
            )}

            {modal.status === 'error' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--theme-error-600)' }}>
                    Import Failed
                  </h3>
                  <button
                    onClick={() => setModal({ status: 'idle' })}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 20, color: 'var(--theme-elevation-500)', padding: 0, lineHeight: 1,
                    }}
                  >
                    <CloseIcon size={20} />
                  </button>
                </div>
                <p style={{ fontSize: 14, color: 'var(--theme-text)', margin: '0 0 16px' }}>
                  {modal.message}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {portalTarget
        ? createPortal(triggerButton, portalTarget)
        : triggerButton}
    </>
  )
}

