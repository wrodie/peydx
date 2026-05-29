'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { SlideEngine } from 'signage-core'
import type { Program } from 'signage-core'

export default function ProgramPreview() {
  const { id } = useParams<{ id: string }>()
  const [program, setProgram] = useState<Program | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/programs/${id}?depth=2`)
      .then((r) => {
        if (!r.ok) throw new Error('Program not found')
        return r.json()
      })
      .then(setProgram)
      .catch((e) => {
        setError(e.message)
      })
  }, [id])

  if (error || !program) {
    return (
      <div className="slide-stage">
        <div className={error ? 'slide-status-text slide-error' : 'slide-status-text'}>
          {error || 'Loading...'}
        </div>
      </div>
    )
  }

  return <SlideEngine program={program} onProgramEnd={() => {}} />
}
