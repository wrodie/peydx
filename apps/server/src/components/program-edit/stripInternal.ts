export function stripInternal(slides: any[]): any[] {
  return slides
    .filter((s: any) => s && s.blockType && !String(s.id).startsWith('auto'))
    .map((s: any) => {
      const cleaned: any = { ...s }
      delete cleaned.id
      delete cleaned._moveToSegment
      cleaned.bulkMedia = null

      if (cleaned.blockType === 'segmentBlock' && cleaned.slides) {
        cleaned.slides = stripInternal(cleaned.slides)
      }

      return cleaned
    })
}
