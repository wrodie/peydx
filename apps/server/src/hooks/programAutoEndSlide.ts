import type { CollectionAfterReadHook } from 'payload'

export const programAutoEndSlide: CollectionAfterReadHook = ({ doc }) => {
  if (doc.slides && Array.isArray(doc.slides)) {
    doc.slides = doc.slides.filter((s: any) => s && s.blockType)
  }
  if ((doc as any).autoBlackEndSlide
    && !(doc as any).loop
    && doc.slides
    && Array.isArray(doc.slides)
    && doc.slides.length > 0
    && doc.slides[doc.slides.length - 1]?.blockType !== 'blackScreenBlock'
    && !doc.slides.some((s: any) => s.id === 'auto-end')
  ) {
    doc.slides = [...doc.slides, {
      id: 'auto-end',
      blockType: 'blackScreenBlock',
      advanceMode: 'manual',
      transition: 'fade',
      duration: null,
    }]
  }
  return doc
}
