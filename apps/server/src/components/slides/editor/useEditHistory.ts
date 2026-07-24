import { useState, useCallback, useRef } from 'react'
import type { SlideDesign } from './types'

export function useEditHistory(initial: SlideDesign) {
  const pastRef = useRef<SlideDesign[]>([])
  const futureRef = useRef<SlideDesign[]>([])
  const [current, setCurrent] = useState<SlideDesign>(initial)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentRef = useRef(current)
  currentRef.current = current

  const pushState = useCallback((design: SlideDesign) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      const snapshot = structuredClone?.(currentRef.current) ?? JSON.parse(JSON.stringify(currentRef.current))
      pastRef.current = [...pastRef.current, snapshot]
      futureRef.current = []
      setCurrent(design)
    }, 300)
  }, [])

  const undo = useCallback((): SlideDesign | null => {
    if (pastRef.current.length === 0) return null
    const previous = pastRef.current[pastRef.current.length - 1]
    pastRef.current = pastRef.current.slice(0, -1)
    futureRef.current = [...futureRef.current, structuredClone?.(currentRef.current) ?? JSON.parse(JSON.stringify(currentRef.current))]
    setCurrent(previous)
    return previous
  }, [])

  const redo = useCallback((): SlideDesign | null => {
    if (futureRef.current.length === 0) return null
    const next = futureRef.current[futureRef.current.length - 1]
    futureRef.current = futureRef.current.slice(0, -1)
    pastRef.current = [...pastRef.current, structuredClone?.(currentRef.current) ?? JSON.parse(JSON.stringify(currentRef.current))]
    setCurrent(next)
    return next
  }, [])

  const canUndo = pastRef.current.length > 0
  const canRedo = futureRef.current.length > 0

  return { current, pushState, undo, redo, canUndo, canRedo, setCurrent }
}
