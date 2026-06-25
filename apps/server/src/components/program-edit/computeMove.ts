export type ComputeMoveParams = {
  rootPath: string
  topLevelSlides: any[]
  srcContainer: string | null
  srcIndex: number
  dstContainer: string | null
  dstIndex: number
}

export type ComputeMoveResult =
  | { kind: 'same-container'; path: string; moveFromIndex: number; moveToIndex: number }
  | { kind: 'cross-container'; removePath: string; removeIndex: number; insertPath: string; insertIndex: number }
  | null

export function findTopLevelSegmentIndex(slides: any[], segmentId: string): number {
  return slides.findIndex(
    (s: any, i: number) =>
      s.blockType === 'segmentBlock' &&
      (s.id === segmentId || `seg-${i}` === segmentId)
  )
}

export function computeMove(params: ComputeMoveParams): ComputeMoveResult {
  const { rootPath, topLevelSlides, srcContainer, srcIndex, dstContainer, dstIndex } = params

  if (srcContainer === dstContainer) {
    if (srcContainer === null) {
      let moveTo = dstIndex
      if (moveTo > srcIndex) moveTo--
      return {
        kind: 'same-container',
        path: rootPath,
        moveFromIndex: srcIndex,
        moveToIndex: moveTo,
      }
    } else {
      const segIdx = findTopLevelSegmentIndex(topLevelSlides, srcContainer)
      if (segIdx < 0) return null
      let moveTo = dstIndex
      if (moveTo > srcIndex) moveTo--
      return {
        kind: 'same-container',
        path: `${rootPath}.${segIdx}.slides`,
        moveFromIndex: srcIndex,
        moveToIndex: moveTo,
      }
    }
  }

  let removePath: string
  if (srcContainer === null) {
    removePath = rootPath
  } else {
    const srcSegIdx = findTopLevelSegmentIndex(topLevelSlides, srcContainer)
    if (srcSegIdx < 0) return null
    removePath = `${rootPath}.${srcSegIdx}.slides`
  }

  let insertPath: string
  if (dstContainer === null) {
    insertPath = rootPath
  } else {
    const dstSegIdx = findTopLevelSegmentIndex(topLevelSlides, dstContainer)
    if (dstSegIdx < 0) return null
    insertPath = `${rootPath}.${dstSegIdx}.slides`
  }

  return {
    kind: 'cross-container',
    removePath,
    removeIndex: srcIndex,
    insertPath,
    insertIndex: dstIndex,
  }
}
