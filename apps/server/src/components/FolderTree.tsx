'use client'

import { useListQuery, usePreferences } from '@payloadcms/ui'
import { useCallback, useEffect, useState } from 'react'

interface Folder {
  id: number
  name: string
  parent: number | { id: number } | null
  children: Folder[]
}

function buildTree(docs: any[]): Folder[] {
  const map = new Map<number, Folder>()
  const roots: Folder[] = []

  for (const doc of docs) {
    map.set(doc.id, { ...doc, children: [] })
  }

  for (const doc of docs) {
    const parentId = doc.parent
      ? typeof doc.parent === 'object'
        ? doc.parent.id
        : doc.parent
      : null
    if (parentId != null && map.has(parentId)) {
      map.get(parentId)!.children.push(map.get(doc.id)!)
    } else {
      roots.push(map.get(doc.id)!)
    }
  }

  return roots
}

const s = {
  tree: {
    padding: '12px 0',
    borderBottom: '1px solid var(--theme-elevation-100, #f3f4f6)',
  } as React.CSSProperties,
  title: {
    fontWeight: 600,
    fontSize: '0.85rem',
    marginBottom: 8,
    color: 'var(--theme-elevation-600, #6b7280)',
  } as React.CSSProperties,
  row: (active: boolean, depth: number): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    padding: `4px 4px 4px ${depth * 16 + 4}px`,
    borderRadius: 4,
    cursor: 'pointer',
    background: active ? 'var(--theme-elevation-200, #e5e7eb)' : 'transparent',
    fontSize: '0.875rem',
    gap: 4,
  }),
  label: (active: boolean): React.CSSProperties => ({
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontWeight: active ? 600 : 400,
    color: active ? 'var(--theme-primary-500, #3b82f6)' : 'inherit',
  }),
  chevron: {
    cursor: 'pointer',
    width: 16,
    textAlign: 'center',
    flexShrink: 0,
    userSelect: 'none',
  } as React.CSSProperties,
  addBtn: {
    fontSize: '0.7rem',
    padding: '1px 6px',
    opacity: 0.6,
    cursor: 'pointer',
    border: 'none',
    borderRadius: 3,
    background: 'var(--theme-elevation-200, #e5e7eb)',
    color: 'var(--theme-elevation-800, #1f2937)',
    flexShrink: 0,
  } as React.CSSProperties,
  newFolderBtn: {
    background: 'var(--theme-primary-500, #3b82f6)',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    padding: '4px 12px',
    fontSize: '0.8rem',
    width: '100%',
    marginTop: 8,
    fontWeight: 500,
  } as React.CSSProperties,
  inlineForm: {
    display: 'flex',
    gap: 4,
    marginTop: 6,
  } as React.CSSProperties,
  inlineInput: {
    padding: '4px 8px',
    fontSize: '0.8rem',
    borderRadius: 4,
    border: '1px solid var(--theme-elevation-300, #d1d5db)',
    width: 140,
  } as React.CSSProperties,
  inlineBtn: {
    background: 'var(--theme-elevation-200, #e5e7eb)',
    border: '1px solid var(--theme-elevation-300, #d1d5db)',
    borderRadius: 4,
    cursor: 'pointer',
    padding: '2px 8px',
    fontSize: '0.75rem',
  } as React.CSSProperties,
  dimText: {
    padding: '4px 8px',
    fontSize: '0.8rem',
    color: 'var(--theme-elevation-500, #9ca3af)',
  } as React.CSSProperties,
}

export function FolderTree() {
  const { getPreference, setPreference } = usePreferences()
  const { query, handleWhereChange, collectionSlug } = useListQuery()
  const [folders, setFolders] = useState<Folder[]>([])
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [activeFolder, setActiveFolder] = useState<number | 'unfiled' | null>(null)
  const [showNewFolder, setShowNewFolder] = useState<number | 'root' | null>(null)
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)

  const folderType = collectionSlug === 'media' ? 'media' : 'programs'

  const fetchFolders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/folders?depth=0&where[type][equals]=${folderType}&limit=100&sort=order`
      )
      const data = await res.json()
      if (data.docs) {
        setFolders(buildTree(data.docs))
      }
    } catch (err) {
      console.error('Failed to fetch folders', err)
    }
    setLoading(false)
  }, [folderType])

  useEffect(() => {
    fetchFolders()
  }, [fetchFolders])

  useEffect(() => {
    const w = query?.where as any
    if (!w || Object.keys(w).length === 0) {
      setActiveFolder(null)
      return
    }
    if (w?.folder?.exists === false) {
      setActiveFolder('unfiled')
      return
    }
    if (w?.folder?.equals !== undefined) {
      const id =
        typeof w.folder.equals === 'object' ? w.folder.equals.id : w.folder.equals
      setActiveFolder(Number(id))
      return
    }
    if (w?.folder?.in !== undefined) {
      const ids = Array.isArray(w.folder.in) ? w.folder.in : [w.folder.in]
      if (ids.length === 1) {
        setActiveFolder(Number(ids[0]))
        return
      }
    }
    setActiveFolder(null)
  }, [query?.where])

  const canNest = (depth: number) => depth < 2

  const saveFolderPreference = async (value: number | null) => {
    await setPreference('current-folder', { value })
  }

  const navigateToFolder = async (folderId: number) => {
    await saveFolderPreference(folderId)
    if (handleWhereChange) {
      await handleWhereChange({ folder: { equals: folderId } })
    }
    setActiveFolder(folderId)
  }

  const navigateToUnfiled = async () => {
    await saveFolderPreference(null)
    if (handleWhereChange) {
      await handleWhereChange({ folder: { exists: false } })
    }
    setActiveFolder('unfiled')
  }

  const navigateToAll = async () => {
    await saveFolderPreference(null)
    if (handleWhereChange) {
      await handleWhereChange({})
    }
    setActiveFolder(null)
  }

  const toggleExpand = (folderId: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }

  const handleCreateFolder = async (parentId: number | null) => {
    if (!newName.trim()) return
    try {
      const body: any = {
        name: newName.trim(),
        type: folderType,
        order: 0,
      }
      if (parentId != null) {
        body.parent = parentId
      }
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err?.errors?.[0]?.message || err?.message || 'Failed to create folder')
      }
      setNewName('')
      setShowNewFolder(null)
      fetchFolders()
    } catch (e: any) {
      alert(e?.message || 'Failed to create folder')
    }
  }

  const startNewFolder = (parentId: number | 'root') => {
    setShowNewFolder(parentId)
    setNewName('')
  }

  const cancelNewFolder = () => {
    setShowNewFolder(null)
    setNewName('')
  }

  const renderInlineForm = (parentId: number | null, depth: number) => (
    <div style={{ ...s.inlineForm, paddingLeft: (depth + 1) * 16 + 20 }}>
      <input
        autoFocus
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleCreateFolder(parentId)
          if (e.key === 'Escape') cancelNewFolder()
        }}
        placeholder="Folder name"
        style={s.inlineInput}
      />
      <button onClick={() => handleCreateFolder(parentId)} style={s.inlineBtn}>OK</button>
      <button onClick={cancelNewFolder} style={s.inlineBtn}>✕</button>
    </div>
  )

  const renderNode = (folder: Folder, depth: number = 0): React.ReactNode => {
    const isExpanded = expanded.has(folder.id)
    const isActive = activeFolder === folder.id
    const hasChildren = folder.children.length > 0

    return (
      <div key={folder.id}>
        <div style={s.row(isActive, depth)}>
          <span
            style={s.chevron}
            onClick={(e) => {
              e.stopPropagation()
              if (hasChildren) toggleExpand(folder.id)
            }}
          >
            {hasChildren ? (isExpanded ? '▾' : '▸') : ''}
          </span>
          <span onClick={() => navigateToFolder(folder.id)} style={s.label(isActive)}>
            {folder.name}
          </span>
          {canNest(depth) && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                startNewFolder(folder.id)
              }}
              style={s.addBtn}
              title="Add subfolder"
            >
              +
            </button>
          )}
        </div>
        {isExpanded && folder.children.map((child) => renderNode(child, depth + 1))}
        {showNewFolder === folder.id && renderInlineForm(folder.id, depth)}
      </div>
    )
  }

  return (
    <div style={s.tree}>
      <div style={s.title}>Folders</div>

      <div style={s.row(activeFolder === null, 0)} onClick={navigateToAll}>
        <span style={s.chevron} />
        <span style={s.label(activeFolder === null)}>
          All {collectionSlug === 'media' ? 'Media' : 'Programs'}
        </span>
      </div>

      <div style={s.row(activeFolder === 'unfiled', 0)} onClick={navigateToUnfiled}>
        <span style={s.chevron} />
        <span style={s.label(activeFolder === 'unfiled')}>Unfiled</span>
      </div>

      <div style={{ marginTop: 4 }}>
        {loading ? (
          <div style={s.dimText}>Loading...</div>
        ) : folders.length === 0 ? (
          <div style={s.dimText}>No folders yet</div>
        ) : (
          folders.map((f) => renderNode(f))
        )}
      </div>

      {showNewFolder === 'root' && renderInlineForm(null, 0)}

      {showNewFolder !== 'root' && (
        <button onClick={() => startNewFolder('root')} style={s.newFolderBtn}>
          + New Folder
        </button>
      )}
    </div>
  )
}
