'use client'

import { useState, useRef, useEffect } from 'react'
import { CloseIcon } from './icons'

type ModalState =
  | { status: 'idle' }
  | { status: 'fileSelected'; fileName: string; file: File }
  | { status: 'progress'; phase: string; current?: number; total?: number; name?: string }
  | { status: 'success'; programTitle: string; mediaCreated: number; skipped: string[] }
  | { status: 'error'; message: string; skipped?: string[] }

interface Department {
  id: number
  name: string
}

export function ImportPptxButton() {
  const [modal, setModal] = useState<ModalState>({ status: 'idle' })
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedDeptId, setSelectedDeptId] = useState<number | undefined>()
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/departments?limit=100')
      .then((r) => r.json())
      .then((data) => {
        const list: Department[] = data.docs || []
        setDepartments(list)
        if (list.length === 1) setSelectedDeptId(list[0].id)
      })
      .catch(() => {})
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pptx')) {
      setModal({ status: 'error', message: 'Only .pptx files are supported' })
      return
    }
    setModal({ status: 'fileSelected', fileName: file.name, file })
  }

  const handleUpload = async () => {
    if (modal.status !== 'fileSelected') return
    const file = modal.file
    if (!file) return

    setModal({ status: 'progress', phase: 'starting' })

    try {
      const formData = new FormData()
      formData.append('file', file)
      if (selectedDeptId) {
        formData.append('department', String(selectedDeptId))
      }

      const res = await fetch('/api/import-pptx', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      const contentType = res.headers.get('Content-Type') || ''

      if (contentType.includes('ndjson')) {
        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let done = false

        while (!done) {
          const { value, done: streamDone } = await reader.read()
          done = streamDone

          if (value) {
            buffer += decoder.decode(value, { stream: !done })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (!line.trim()) continue
              try {
                const msg = JSON.parse(line)

                if (msg.type === 'phase') {
                  setModal({
                    status: 'progress',
                    phase: msg.phase,
                    current: msg.current,
                    total: msg.total,
                    name: msg.name,
                  })
                } else if (msg.type === 'result') {
                  setModal({
                    status: 'success',
                    programTitle: msg.program?.title || 'Program',
                    mediaCreated: msg.mediaCreated?.length || 0,
                    skipped: msg.skipped || [],
                  })
                } else if (msg.type === 'error') {
                  setModal({
                    status: 'error',
                    message: msg.message || 'Import failed',
                    skipped: msg.skipped,
                  })
                }
              } catch {
                // skip malformed lines
              }
            }
          }
        }
      } else {
        const data = await res.json()
        if (!res.ok) {
          setModal({
            status: 'error',
            message: data.error || 'Import failed',
            skipped: data.skipped,
          })
          return
        }
        setModal({
          status: 'success',
          programTitle: data.program?.title || 'Program',
          mediaCreated: data.mediaCreated?.length || 0,
          skipped: data.skipped || [],
        })
      }
    } catch (err: any) {
      setModal({ status: 'error', message: err.message || 'Import failed' })
    }
  }

  const handleViewProgram = () => {
    window.location.reload()
  }

  const reset = () => {
    setModal({ status: 'idle' })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const triggerFile = () => {
    fileInputRef.current?.click()
  }

  const progressPct = modal.status === 'progress' && modal.total && modal.current
    ? Math.round((modal.current / modal.total) * 100)
    : null

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pptx"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {modal.status === 'idle' && (
        <button
          type="button"
          className="btn btn--style-pill btn--size-small"
          onClick={triggerFile}
          style={{ whiteSpace: 'nowrap' }}
        >
          Import PPTX
        </button>
      )}

      {modal.status !== 'idle' && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.4)',
          }}
          onClick={modal.status === 'progress' ? undefined : modal.status === 'success' ? handleViewProgram : reset}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--theme-bg)', borderRadius: 8, padding: 24,
              width: 480, maxWidth: '90vw',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}
          >
            {(modal.status === 'fileSelected') && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Import PPTX</h3>
                  <button onClick={reset} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--theme-elevation-500)', padding: 0, lineHeight: 1 }}>
                    <CloseIcon size={20} />
                  </button>
                </div>

                <div
                  style={{
                    padding: '12px 16px',
                    marginBottom: 16,
                    background: 'var(--theme-elevation-100)',
                    borderRadius: 4,
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {modal.fileName}
                  </span>
                  <button
                    onClick={triggerFile}
                    style={{
                      padding: '4px 10px', fontSize: 12, borderRadius: 4,
                      border: '1px solid var(--theme-elevation-250)',
                      background: 'var(--theme-bg)', cursor: 'pointer',
                      whiteSpace: 'nowrap', flexShrink: 0,
                    }}
                  >
                    Change
                  </button>
                </div>

                {departments.length > 1 && (
                  <div style={{ marginBottom: 16 }}>
                    <label
                      htmlFor="import-dept"
                      style={{
                        display: 'block',
                        marginBottom: 6,
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--theme-elevation-600)',
                      }}
                    >
                      Department to import into
                    </label>
                    <select
                      id="import-dept"
                      value={selectedDeptId ?? ''}
                      onChange={(e) => setSelectedDeptId(e.target.value ? Number(e.target.value) : undefined)}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        padding: '10px 12px', fontSize: 14,
                        border: '1px solid var(--theme-elevation-250)',
                        borderRadius: 4,
                        background: 'var(--theme-input-bg)',
                        color: 'var(--theme-text)',
                        outline: 'none',
                      }}
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div
                  style={{
                    padding: '12px 16px',
                    marginBottom: 16,
                    background: 'var(--theme-elevation-50)',
                    borderRadius: 4,
                    fontSize: 12,
                    lineHeight: 1.5,
                    color: 'var(--theme-elevation-600)',
                    border: '1px solid var(--theme-elevation-200)',
                  }}
                >
                  This is a limited PPTX import. It will only import full-screen images, audio,
                  and video files. It will not import text, shapes, or smaller graphics.
                  Depending on the file size, it may take some time.
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    onClick={reset}
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
                    onClick={handleUpload}
                    style={{
                      padding: '8px 16px', fontSize: 13, borderRadius: 4,
                      border: 'none', cursor: 'pointer',
                      background: 'var(--theme-elevation-800)',
                      color: 'var(--theme-elevation-0)',
                    }}
                  >
                    Import
                  </button>
                </div>
              </>
            )}

            {modal.status === 'progress' && (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div
                  style={{
                    width: 32, height: 32,
                    border: '3px solid var(--theme-elevation-200)',
                    borderTopColor: 'var(--theme-elevation-800)',
                    borderRadius: '50%',
                    margin: '0 auto 16px',
                    animation: 'pptx-spin 0.8s linear infinite',
                  }}
                />
                <style>{`@keyframes pptx-spin { to { transform: rotate(360deg) } }`}</style>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>
                  {modal.phase === 'parsing' && 'Parsing PPTX…'}
                  {modal.phase === 'folders' && 'Creating folders…'}
                  {modal.phase === 'media' && `Importing media ${modal.current}/${modal.total}…`}
                  {modal.phase === 'program' && 'Creating program…'}
                  {modal.phase === 'starting' && 'Starting import…'}
                </p>
                {modal.phase === 'media' && modal.name && (
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--theme-elevation-500)' }}>
                    {modal.name}
                  </p>
                )}
                {progressPct !== null && (
                  <div
                    style={{
                      margin: '12px auto 0',
                      width: '80%',
                      height: 6,
                      background: 'var(--theme-elevation-200)',
                      borderRadius: 3,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${progressPct}%`,
                        height: '100%',
                        background: 'var(--theme-elevation-600)',
                        borderRadius: 3,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {modal.status === 'success' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--theme-success-600)' }}>
                    Import Complete
                  </h3>
                  <button onClick={handleViewProgram} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--theme-elevation-500)', padding: 0, lineHeight: 1 }}>
                    <CloseIcon size={20} />
                  </button>
                </div>
                <p style={{ fontSize: 14, margin: '0 0 8px' }}>
                  Created program: <strong>{modal.programTitle}</strong>
                </p>
                <p style={{ fontSize: 14, margin: '0 0 16px' }}>
                  {modal.mediaCreated} media {modal.mediaCreated === 1 ? 'item' : 'items'} imported.
                </p>
                {modal.skipped.length > 0 && (
                  <details style={{ marginBottom: 16, fontSize: 13 }}>
                    <summary style={{ cursor: 'pointer', color: 'var(--theme-warning-600)' }}>
                      {modal.skipped.length} item{modal.skipped.length === 1 ? '' : 's'} skipped
                    </summary>
                    <ul style={{ margin: '8px 0 0', padding: '0 0 0 20px', color: 'var(--theme-elevation-600)' }}>
                      {modal.skipped.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </details>
                )}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    onClick={reset}
                    style={{
                      padding: '8px 16px', fontSize: 13, borderRadius: 4,
                      border: '1px solid var(--theme-elevation-250)',
                      background: 'var(--theme-elevation-50)',
                      color: 'var(--theme-text)', cursor: 'pointer',
                    }}
                  >
                    Import Another
                  </button>
                  <button
                    onClick={handleViewProgram}
                    style={{
                      padding: '8px 16px', fontSize: 13, borderRadius: 4,
                      border: 'none', cursor: 'pointer',
                      background: 'var(--theme-elevation-800)',
                      color: 'var(--theme-elevation-0)',
                    }}
                  >
                    View Programs
                  </button>
                </div>
              </>
            )}

            {modal.status === 'error' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--theme-error-600)' }}>
                    Import Failed
                  </h3>
                  <button onClick={reset} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--theme-elevation-500)', padding: 0, lineHeight: 1 }}>
                    <CloseIcon size={20} />
                  </button>
                </div>
                <p style={{ fontSize: 14, color: 'var(--theme-text)', margin: '0 0 16px', whiteSpace: 'pre-wrap' }}>
                  {modal.message}
                </p>
                {modal.skipped && modal.skipped.length > 0 && (
                  <details style={{ marginBottom: 16, fontSize: 13 }}>
                    <summary style={{ cursor: 'pointer', color: 'var(--theme-warning-600)' }}>
                      {modal.skipped.length} item{modal.skipped.length === 1 ? '' : 's'} skipped
                    </summary>
                    <ul style={{ margin: '8px 0 0', padding: '0 0 0 20px', color: 'var(--theme-elevation-600)' }}>
                      {modal.skipped.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </details>
                )}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    onClick={triggerFile}
                    style={{
                      padding: '8px 16px', fontSize: 13, borderRadius: 4,
                      border: '1px solid var(--theme-elevation-250)',
                      background: 'var(--theme-elevation-50)',
                      color: 'var(--theme-text)', cursor: 'pointer',
                    }}
                  >
                    Try Again
                  </button>
                  <button
                    onClick={reset}
                    style={{
                      padding: '8px 16px', fontSize: 13, borderRadius: 4,
                      border: 'none', cursor: 'pointer',
                      background: 'var(--theme-elevation-800)',
                      color: 'var(--theme-elevation-0)',
                    }}
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
