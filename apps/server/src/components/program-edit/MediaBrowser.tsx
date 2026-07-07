'use client'

import { useDraggable } from '@dnd-kit/core'
import { useCallback, useEffect, useRef, useState, type FC } from 'react'
import { usePreferences } from '@payloadcms/ui'
import {
  ImageIcon,
  MovieIcon,
  VolumeUpIcon,
  DescriptionIcon,
  CheckIcon,
  FolderIcon,
  ExpandCircleDownIcon,
  ExpandCircleRightIcon,
  MenuOpenIcon,
  ChevronLeftIcon,
} from '../icons'

interface Folder {
  id: number
  name: string
  parent: number | { id: number } | null
  children: Folder[]
}

interface MediaItem {
  id: number
  filename: string
  name?: string
  mimeType: string
  url?: string
  sizes?: { thumbnail?: { url: string } }
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

const DraggableMediaItem: FC<{
  media: MediaItem
  isSelected: boolean
  selectedIds: Set<number>
  allVisibleMedia: MediaItem[]
  onToggleSelect: (id: number) => void
}> = ({ media, isSelected, selectedIds, allVisibleMedia, onToggleSelect }) => {
  const dragItems = isSelected
    ? allVisibleMedia.filter(m => selectedIds.has(m.id)).map(m => ({ id: m.id, mimeType: m.mimeType, filename: m.filename, url: m.url, sizes: m.sizes, name: m.name }))
    : [{ id: media.id, mimeType: media.mimeType, filename: media.filename, url: media.url, sizes: media.sizes, name: media.name }]

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `media-${media.id}`,
      data: { type: 'media', items: dragItems },
    })

  const style: React.CSSProperties = {
    transform: transform
      ? `translate(${transform.x}px, ${transform.y}px)`
      : undefined,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
  }

  const isImage = media.mimeType?.startsWith('image/')
  const isVideo = media.mimeType?.startsWith('video/')
  const isAudio = media.mimeType?.startsWith('audio/')

  const icon = isImage ? <ImageIcon size={36} style={{ opacity: 0.6 }} /> : isVideo ? <MovieIcon size={36} style={{ opacity: 0.6 }} /> : isAudio ? (
    <VolumeUpIcon size={36} style={{ opacity: 0.6 }} />
  ) : <DescriptionIcon size={36} style={{ opacity: 0.6 }} />
  const thumbnailUrl = media.sizes?.thumbnail?.url || (isImage ? media.url : null)

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        ...style,
        width: 96,
        flexShrink: 0,
        borderRadius: 6,
        overflow: 'hidden',
        border: isSelected
          ? '2px solid var(--theme-primary-500, #3b82f6)'
          : '1px solid var(--theme-elevation-200, #e5e7eb)',
        background: 'var(--theme-elevation-0)',
      }}
    >
      <div
        onPointerDown={(e) => {
          if (e.ctrlKey && e.button === 0) {
            e.stopPropagation()
            onToggleSelect(media.id)
          }
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <div
          style={{
            width: '100%',
            height: 64,
            background: 'var(--theme-elevation-100, #f3f4f6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.6rem',
            position: 'relative',
          }}
        >
          {thumbnailUrl && !isAudio ? (
            <img
              src={thumbnailUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            icon
          )}
          {isSelected && (
            <div
              style={{
                position: 'absolute',
                top: 2,
                right: 2,
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: 'var(--theme-primary-500, #3b82f6)',
                color: 'white',
                fontSize: '0.6rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
              }}
            >
              <CheckIcon size={10} />
            </div>
          )}
        </div>
        <div
          style={{
            padding: '4px 6px',
            fontSize: '0.65rem',
            color: 'var(--theme-elevation-600, #4b5563)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {media.name || media.filename}
        </div>
      </div>
    </div>
  )
}

export const MediaBrowser: FC<{
  collapsed: boolean
  onToggle: () => void
  clearSelectionRef?: React.MutableRefObject<(() => void) | null>
}> = ({ collapsed, onToggle, clearSelectionRef }) => {
  const [folders, setFolders] = useState<Folder[]>([])
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [selectedFolder, setSelectedFolder] = useState<number | null>(null)
  const [parentMap, setParentMap] = useState<Record<number, number | null>>({})
  const [media, setMedia] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [mediaLoading, setMediaLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { getPreference, setPreference } = usePreferences()

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])
  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  useEffect(() => {
    if (clearSelectionRef) {
      clearSelectionRef.current = clearSelection
      return () => { clearSelectionRef.current = null }
    }
  }, [clearSelection, clearSelectionRef])

  const fetchFolders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/folders?depth=0&where[type][equals]=media&limit=100&sort=order,name')
      const data = await res.json()
      if (data.docs) {
        const map: Record<number, number | null> = {}
        for (const doc of data.docs) {
          const parentId = doc.parent
            ? typeof doc.parent === 'object'
              ? doc.parent.id
              : doc.parent
            : null
          map[doc.id] = parentId
        }
        setParentMap(map)
        setFolders(buildTree(data.docs))
      }
    } catch (err) {
      console.error('Failed to fetch folders', err)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchFolders()
  }, [fetchFolders])

  const expandAncestors = useCallback((folderId: number) => {
    const ancestors: number[] = []
    let currentId = folderId
    while (currentId && parentMap[currentId] != null) {
      ancestors.push(parentMap[currentId]!)
      currentId = parentMap[currentId]!
    }
    if (ancestors.length > 0) {
      setExpanded(prev => {
        const next = new Set(prev)
        ancestors.forEach(id => next.add(id))
        return next
      })
    }
  }, [parentMap])

  const restoredRef = useRef(false)

  useEffect(() => {
    if (restoredRef.current) return
    if (loading) return
    const restore = async () => {
      const pref = await getPreference('media-browser-folder')
      const folderId = pref?.value as number | null | undefined
      if (folderId != null) {
        expandAncestors(folderId)
        setSelectedFolder(folderId)
      }
      restoredRef.current = true
    }
    restore()
  }, [getPreference, expandAncestors, loading])

  const buildUrl = useCallback((folderId: number | null, searchTerm: string, pageNum: number) => {
    let url = `/api/media?depth=0&limit=50&sort=name&page=${pageNum}`
    if (folderId) url += `&where[folder][equals]=${folderId}`
    if (searchTerm) url += `&where[name][like]=${encodeURIComponent(searchTerm)}`
    return url
  }, [])

  const fetchMedia = useCallback(async (folderId: number | null, searchTerm: string, pageNum: number, append: boolean) => {
    setMediaLoading(true)
    try {
      const url = buildUrl(folderId, searchTerm, pageNum)
      const res = await fetch(url)
      const data = await res.json()
      const docs = data.docs || []
      if (append) {
        setMedia(prev => [...prev, ...docs])
      } else {
        setMedia(docs)
      }
      setTotalPages(data.totalPages || 1)
    } catch (err) {
      console.error('Failed to fetch media', err)
    }
    setMediaLoading(false)
  }, [buildUrl])

  const loadInitial = useCallback((folderId: number | null, searchTerm: string) => {
    setPage(1)
    fetchMedia(folderId, searchTerm, 1, false)
  }, [fetchMedia])

  useEffect(() => {
    loadInitial(selectedFolder, search)
  }, [selectedFolder, loadInitial])

  const handleSearchChange = (value: string) => {
    clearSelection()
    setSearch(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      fetchMedia(selectedFolder, value, 1, false)
    }, 300)
  }

  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchMedia(selectedFolder, search, nextPage, true)
  }

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const renderFolderNode = (folder: Folder, depth: number = 0): React.ReactNode => {
    const isExpanded = expanded.has(folder.id)
    const isSelected = selectedFolder === folder.id
    const hasChildren = folder.children.length > 0

    return (
      <div key={folder.id}>
        <div
          onClick={() => { clearSelection(); setSelectedFolder(folder.id); setPreference('media-browser-folder', { value: folder.id }) }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '1px 0',
            paddingLeft: depth * 12 + 8,
            cursor: 'pointer',
            fontSize: '1rem',
            background: isSelected ? 'var(--theme-elevation-200, #e5e7eb)' : 'transparent',
            borderRadius: 4,
            fontWeight: isSelected ? 600 : 400,
          }}
        >
          <span
            onClick={(e) => {
              e.stopPropagation()
              if (hasChildren) toggleExpand(folder.id)
            }}
            style={{
              width: 32,
              flexShrink: 0,
              fontSize: '1rem',
              color: 'var(--theme-elevation-400, #9ca3af)',
              cursor: hasChildren ? 'pointer' : 'default',
              padding: '0 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {hasChildren ? (isExpanded ? <ExpandCircleDownIcon size={24} /> : <ExpandCircleRightIcon size={24} />) : ' '}
          </span>
          <FolderIcon size={16} /> {folder.name}
        </div>
        {isExpanded && folder.children.map((child) => renderFolderNode(child, depth + 1))}
      </div>
    )
  }

  if (collapsed) {
    return (
      <div
        style={{
          width: 32,
          flexShrink: 0,
          borderRight: '1px solid var(--theme-elevation-200, #e5e7eb)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 10,
        }}
      >
        <button
          onClick={onToggle}
          style={{
            background: 'transparent',
            border: '1px solid var(--theme-elevation-300, #d1d5db)',
            borderRadius: 4,
            cursor: 'pointer',
            padding: '4px 8px',
            fontSize: '0.85rem',
            lineHeight: 1,
          }}
          title="Open Media Browser"
        >
          <MenuOpenIcon size={16} />
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        width: 360,
        flexShrink: 0,
        borderRight: '1px solid var(--theme-elevation-200, #e5e7eb)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid var(--theme-elevation-200, #e5e7eb)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--theme-elevation-600, #4b5563)' }}>
          <FolderIcon size={16} /> Media Browser
        </span>
        <button
          onClick={onToggle}
          style={{
            background: 'transparent',
            border: '1px solid var(--theme-elevation-300, #d1d5db)',
            borderRadius: 4,
            cursor: 'pointer',
            padding: '4px 8px',
            fontSize: '0.85rem',
            lineHeight: 1,
          }}
          title="Toggle Media Browser"
        >
          <ChevronLeftIcon size={16} />
        </button>
      </div>

      <div style={{ overflow: 'auto', maxHeight: '40%', padding: '8px 12px' }}>
        <div
          onClick={() => { clearSelection(); setSelectedFolder(null); setPreference('media-browser-folder', { value: null }) }}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '3px 8px',
            cursor: 'pointer',
            fontSize: '0.8rem',
            background: selectedFolder === null ? 'var(--theme-elevation-200, #e5e7eb)' : 'transparent',
            borderRadius: 4,
            fontWeight: selectedFolder === null ? 600 : 400,
            marginBottom: 4,
          }}
        >
          All Media
        </div>

        {loading ? (
          <div style={{ fontSize: '0.75rem', color: 'var(--theme-elevation-400, #9ca3af)', padding: '4px 8px' }}>
            Loading folders...
          </div>
        ) : (
          folders.map((f) => renderFolderNode(f))
        )}
      </div>

      <div
        style={{
          borderTop: '1px solid var(--theme-elevation-200, #e5e7eb)',
          padding: '10px 12px',
          flex: 2,
          overflow: 'auto',
          minHeight: 0,
        }}
      >
        <div
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--theme-elevation-500, #6b7280)',
            marginBottom: 8,
          }}
        >
          Media ({media.length})
        </div>
        <input
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search media..."
          style={{
            width: '100%',
            padding: '4px 8px',
            fontSize: '0.75rem',
            border: '1px solid var(--theme-elevation-300, #d1d5db)',
            borderRadius: 4,
            marginBottom: 8,
            boxSizing: 'border-box',
          }}
        />
        {mediaLoading ? (
          <div style={{ fontSize: '0.75rem', color: 'var(--theme-elevation-400, #9ca3af)' }}>
            Loading...
          </div>
        ) : media.length === 0 ? (
          <div style={{ fontSize: '0.75rem', color: 'var(--theme-elevation-400, #9ca3af)' }}>
            No media found
          </div>
        ) : (
          <>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            {media.map((item) => (
              <DraggableMediaItem
                key={item.id}
                media={item}
                isSelected={selectedIds.has(item.id)}
                selectedIds={selectedIds}
                allVisibleMedia={media}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
          {page < totalPages && (
            <button
              onClick={handleLoadMore}
              disabled={mediaLoading}
              style={{
                marginTop: 8,
                padding: '4px 12px',
                fontSize: '0.75rem',
                background: 'var(--theme-elevation-100, #f3f4f6)',
                border: '1px solid var(--theme-elevation-300, #d1d5db)',
                borderRadius: 4,
                cursor: mediaLoading ? 'default' : 'pointer',
                color: 'var(--theme-elevation-600, #4b5563)',
                width: '100%',
              }}
            >
              {mediaLoading ? 'Loading...' : `Load more (${media.length} / ${totalPages * 50})`}
            </button>
          )}
          </>
        )}
      </div>
    </div>
  )
}
