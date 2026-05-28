import { useEffect, useState, useCallback, useRef } from 'react'
import { SlideEngine } from 'signage-core'
import type { Program } from 'signage-core'
import { resolveActiveProgram } from './schedule-resolver'

const POLL_INTERVAL = 60_000
const MANIFEST_URL = '/schedule.json'

export function App() {
  const [activeProgram, setActiveProgram] = useState<Program | null>(null)
  const scheduleRef = useRef<any>(null)

  const loadSchedule = useCallback(async () => {
    try {
      const res = await fetch(MANIFEST_URL)
      if (!res.ok) return
      const data = await res.json()
      scheduleRef.current = data
      const program = resolveActiveProgram(data)
      setActiveProgram(program)
    } catch (err) {
      console.error('Failed to load schedule:', err)
    }
  }, [])

  useEffect(() => {
    loadSchedule()
    const interval = setInterval(loadSchedule, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [loadSchedule])

  if (!activeProgram) {
    return (
      <div className="slide-stage">
        <div className="slide-status-text">No program scheduled</div>
      </div>
    )
  }

  return (
    <SlideEngine
      key={activeProgram.id}
      program={activeProgram}
      onProgramEnd={() => loadSchedule()}
    />
  )
}
