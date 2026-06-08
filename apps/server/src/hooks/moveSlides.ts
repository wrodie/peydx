import type { CollectionBeforeChangeHook } from 'payload'

interface MoveOp {
  slide: Record<string, unknown>
  targetId: string
}

function stripMoveField(slide: Record<string, unknown>): Record<string, unknown> {
  if (!slide) return slide
  const cleaned = { ...slide }
  delete cleaned._moveToSegment
  return cleaned
}

export const moveSlides: CollectionBeforeChangeHook = async ({ data }) => {
  if (!data.slides || !Array.isArray(data.slides)) return data

  const moves: MoveOp[] = []
  const newTopLevel: Record<string, unknown>[] = []

  // First pass: collect moves and rebuild without moved slides
  for (const item of data.slides) {
    if (item.blockType === 'segmentBlock') {
      const newChildren: Record<string, unknown>[] = []
      for (const child of (item.slides || []) as Record<string, unknown>[]) {
        const target = child._moveToSegment as string | undefined
        if (target && target !== '__none__') {
          if (target === '__top__') {
            // Move from segment to top level
            moves.push({ slide: stripMoveField(child), targetId: '__top__' })
          } else if (target !== item.id) {
            // Move to a different segment (or top-level — handled above)
            moves.push({ slide: stripMoveField(child), targetId: target })
          }
          // else: target === current segment → no-op, keep in place
          else {
            newChildren.push(stripMoveField(child))
          }
        } else {
          newChildren.push(stripMoveField(child))
        }
      }
      item.slides = newChildren
      newTopLevel.push(stripMoveField(item))
    } else {
      const target = item._moveToSegment as string | undefined
      if (target && target !== '__none__') {
        if (target !== '__top__') {
          // Move from top level to a segment
          moves.push({ slide: stripMoveField(item), targetId: target })
        }
        // else: target === '__top__' → no-op (already top level)
      } else {
        newTopLevel.push(stripMoveField(item))
      }
    }
  }

  // Second pass: add moved slides to their targets
  for (const { slide, targetId } of moves) {
    if (targetId === '__top__') {
      newTopLevel.push(slide)
    } else {
      const targetSeg = newTopLevel.find(
        (s) => s.blockType === 'segmentBlock' && s.id === targetId
      ) as Record<string, unknown> | undefined
      if (targetSeg) {
        const existingSlides = (targetSeg.slides as Record<string, unknown>[]) || []
        targetSeg.slides = [...existingSlides, slide]
      }
      // If target segment not found, slide is dropped (shouldn't happen)
    }
  }

  data.slides = newTopLevel
  return data
}
