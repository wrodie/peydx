'use client'

import { useEffect, useState } from 'react'
import { useField, useDocumentInfo } from '@payloadcms/ui'

export function SlideMoveSelect(props: any) {
  const { path } = props
  const { value, setValue } = useField<string>({ path })
  const { id } = useDocumentInfo()
  const [segments, setSegments] = useState<any[]>([])

  useEffect(() => {
    if (!id) return
    fetch(`/api/programs/${id}?depth=0`)
      .then((r) => r.json())
      .then((data) => {
        const slides = data?.slides
        setSegments(
          Array.isArray(slides)
            ? slides.filter((s: any) => s?.blockType === 'segmentBlock')
            : []
        )
      })
      .catch(() => setSegments([]))
  }, [id])

  return (
    <div className="field-type select">
      <label className="field-label">
        Move to segment
        <span className="description">
          &nbsp;&mdash; Move this slide to another segment or the top level on save.
          New segments may require saving first before they appear here.
        </span>
      </label>
      <select
        value={value || '__none__'}
        onChange={(e) => setValue(e.target.value)}
        style={{ width: '100%' }}
      >
        <option value="__none__">(Do not move)</option>
        <option value="__top__">Top level</option>
        {segments.map((s: any) => (
          <option key={s.id} value={s.id}>
            {s.name || `Untitled Segment (${s.id?.slice(0, 8) || ''})`}
          </option>
        ))}
      </select>
    </div>
  )
}
