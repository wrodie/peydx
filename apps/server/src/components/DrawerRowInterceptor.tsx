'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useListDrawerContext } from '@payloadcms/ui'

export function DrawerRowInterceptor({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const { onSelect } = useListDrawerContext()

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const handler = (e: MouseEvent) => {
      const tr = (e.target as HTMLElement).closest('tr[data-id]') as HTMLElement | null
      if (!tr) return

      const docId = parseInt(tr.dataset.id || '', 10)
      if (isNaN(docId)) return

      const link = tr.querySelector<HTMLAnchorElement>('a[href*="/admin/collections/"]')
      if (!link) return

      const match = link.getAttribute('href')?.match(/\/admin\/collections\/([^/]+)\/(\d+)/)
      if (!match) return

      onSelect?.({ collectionSlug: match[1] as any, doc: { id: docId } as any, docID: String(docId) })
    }

    el.addEventListener('click', handler)
    return () => el.removeEventListener('click', handler)
  }, [onSelect])

  return (
    <>
      <style>{`
        [data-drawer-scope] a[href*="/admin/collections/"]:not([href*="?"]) { pointer-events: none; }
      `}</style>
      <div ref={ref} data-drawer-scope>
        {children}
      </div>
    </>
  )
}
