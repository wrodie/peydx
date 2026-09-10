'use client'

import { ImportButton } from './ImportButton'
import { PdfFileIcon } from './icons'

export function ImportPdfButton({ collectionSlug }: { collectionSlug: 'media' | 'programs' }) {
  return (
    <ImportButton
      label="Import PDF"
      accept=".pdf"
      endpoint="/api/import-pdf"
      chunkEndpoint="/api/import-pdf-chunk"
      collectionSlug={collectionSlug}
      icon={<PdfFileIcon size={14} />}
      order={1}
      infoText="Each PDF page becomes one image slide. Text is part of the image and cannot be edited in peydx. Depending on the file size, it may take some time."
      phaseLabels={{
        parsing: 'Rendering PDF…',
        media: 'Importing page {current}/{total}…',
      }}
    />
  )
}
