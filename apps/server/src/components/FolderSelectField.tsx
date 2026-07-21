'use client'

import { useEffect, useState } from 'react'
import { useField, useDocumentInfo } from '@payloadcms/ui'

interface FolderNode {
  id: number
  name: string
  parent: number | { id: number } | null
  children: FolderNode[]
}

function buildTree(docs: any[]): FolderNode[] {
  const map = new Map<number, FolderNode>()
  const roots: FolderNode[] = []

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

function flattenTree(
  nodes: FolderNode[],
  level = 0,
): { id: number; name: string; level: number }[] {
  const result: { id: number; name: string; level: number }[] = []
  for (const node of nodes) {
    result.push({ id: node.id, name: node.name, level })
    if (node.children.length > 0) {
      result.push(...flattenTree(node.children, level + 1))
    }
  }
  return result
}

export function FolderSelectField(props: any) {
  const { path } = props
  const { value, setValue } = useField<any>({ path })
  const { collectionSlug } = useDocumentInfo()
  const currentId = value
    ? (typeof value === 'object' ? value.id : value)
    : ''
  const [items, setItems] = useState<
    { id: number; name: string; level: number }[]
  >([])

  const folderType = collectionSlug === 'programs' ? 'programs' : 'media'

  useEffect(() => {
    fetch(
      `/api/folders?depth=0&where[type][equals]=${folderType}&limit=100&sort=order,name`,
    )
      .then((r) => r.json())
      .then((data) => {
        const docs = data?.docs || []
        const tree = buildTree(docs)
        setItems(flattenTree(tree))
      })
      .catch(() => setItems([]))
  }, [folderType])

  return (
    <div className="field-type relationship">
      <label className="field-label">Folder</label>
      <select
        value={currentId}
        onChange={(e) =>
          setValue(e.target.value ? Number(e.target.value) : null)
        }
        style={{
          width: '100%',
          padding: '10px 12px',
          border: '1px solid var(--theme-elevation-300, #d1d5db)',
          borderRadius: 'var(--style-radius-s, 4px)',
          background: 'var(--theme-input-bg, #fff)',
          fontFamily: 'var(--font-body, inherit)',
          fontSize: '1rem',
          color: 'var(--theme-text, #000)',
          lineHeight: 1.5,
          minHeight: '36px',
        }}
      >
        <option value="">(None)</option>
        {items.map((f) => (
          <option key={f.id} value={f.id}>
            {'\u00A0\u00A0\u00A0'.repeat(f.level)}
            {f.name}
          </option>
        ))}
      </select>
    </div>
  )
}
