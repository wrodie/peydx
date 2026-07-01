'use client'

import { createPortal } from 'react-dom'
import { DefaultListView, useListDrawerContext } from '@payloadcms/ui'
import type { ListViewClientProps } from 'payload'
import { useEffect, useState } from 'react'
import { FolderTree } from './FolderTree'
import { DrawerRowInterceptor } from './DrawerRowInterceptor'
import { ExpandCircleDownIcon } from './icons'
import { ImportPptxButton } from './ImportPptxButton'

export function ListWithSidebar(props: ListViewClientProps) {
  const { isInDrawer } = useListDrawerContext()
  const [treeOpen, setTreeOpen] = useState(false)
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!isInDrawer) {
      const el = document.querySelector('.list-header__title-actions')
      if (el instanceof HTMLElement) setPortalTarget(el)
    } else {
      setPortalTarget(null)
    }
  }, [isInDrawer])

  if (isInDrawer) {
    return (
      <DrawerRowInterceptor>
        <DefaultListView {...props} />
      </DrawerRowInterceptor>
    )
  }

  return (
    <>
      {portalTarget && createPortal(<ImportPptxButton />, portalTarget)}
      <style>{`
        .list-with-sidebar { display: flex; align-items: flex-start; }
        .list-with-sidebar__sidebar {
          width: 260px; flex-shrink: 0;
          border-right: 1px solid var(--theme-elevation-100, #f3f4f6);
          padding: 0 12px;
          position: sticky; top: 0; align-self: stretch;
        }
        .list-with-sidebar__content { flex: 1; min-width: 0; }
        .list-with-sidebar__tree-toggle { display: none; }
        @media (max-width: 768px) {
          .list-with-sidebar {
            display: block;
          }
          .list-with-sidebar__sidebar {
            width: 100%; border-right: none;
            border-bottom: 1px solid var(--theme-elevation-100, #f3f4f6);
            position: static;
          }
          .list-with-sidebar__tree-toggle {
            display: flex;
            align-items: center;
            gap: 6px;
            width: 100%;
            padding: 8px 0;
            margin-bottom: 8px;
            font-size: 0.85rem;
            font-weight: 500;
            color: var(--theme-elevation-700);
            background: none;
            border: none;
            cursor: pointer;
            font-family: inherit;
            border-bottom: 1px solid var(--theme-elevation-100);
          }
          .list-with-sidebar__tree-toggle-icon {
            transition: transform 0.2s;
          }
          .list-with-sidebar__tree-toggle-icon--open {
            transform: rotate(180deg);
          }
          .list-with-sidebar__sidebar--collapsed .FolderTree {
            display: none;
          }
        }
        .list-header__title-actions {
          align-items: center;
        }
        .list-header__title-actions .btn {
          margin-block: 0;
          --btn-padding-block-start: 6px;
          --btn-padding-inline-end: 14px;
          --btn-padding-block-end: 6px;
          --btn-padding-inline-start: 14px;
          --bg-color: var(--theme-elevation-100);
          --color: var(--theme-text);
          --btn-border: 1px solid var(--theme-elevation-250);
          --hover-bg: var(--theme-elevation-150);
          --hover-btn-border: 1px solid var(--theme-elevation-250);
          --hover-color: var(--theme-text);
          border-radius: 4px;
          font-size: 13px;
          line-height: normal;
        }
      `}</style>
      <div className="list-with-sidebar">
        <div className={`list-with-sidebar__sidebar${treeOpen ? '' : ' list-with-sidebar__sidebar--collapsed'}`}>
          <button
            type="button"
            className="list-with-sidebar__tree-toggle"
            onClick={() => setTreeOpen(!treeOpen)}
          >
            <span className={`list-with-sidebar__tree-toggle-icon${treeOpen ? ' list-with-sidebar__tree-toggle-icon--open' : ''}`}>
              <ExpandCircleDownIcon size={16} />
            </span>
            Folders
          </button>
          <FolderTree />
        </div>
        <div className="list-with-sidebar__content">
          <DefaultListView {...props} />
        </div>
      </div>
    </>
  )
}
