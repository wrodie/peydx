'use client'

import { DefaultListView } from '@payloadcms/ui'
import type { ListViewClientProps } from 'payload'
import { FolderTree } from './FolderTree'

export function ListWithSidebar(props: ListViewClientProps) {
  return (
    <>
      <style>{`
        .list-with-sidebar { display: flex; align-items: flex-start; }
        .list-with-sidebar__sidebar {
          width: 260px; flex-shrink: 0;
          border-right: 1px solid var(--theme-elevation-100, #f3f4f6);
          padding: 0 12px;
          position: sticky; top: 0; align-self: stretch;
        }
        .list-with-sidebar__content { flex: 1; min-width: 0; }
        @media (max-width: 768px) {
          .list-with-sidebar { flex-direction: column; }
          .list-with-sidebar__sidebar {
            width: 100%; border-right: none;
            border-bottom: 1px solid var(--theme-elevation-100, #f3f4f6);
            position: static;
          }
        }
      `}</style>
      <div className="list-with-sidebar">
        <div className="list-with-sidebar__sidebar">
          <FolderTree />
        </div>
        <div className="list-with-sidebar__content">
          <DefaultListView {...props} />
        </div>
      </div>
    </>
  )
}
