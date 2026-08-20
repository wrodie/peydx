'use client'

import { ImportButton } from './ImportButton'

export function ImportPdfButton() {
  return (
    <ImportButton
      label="Import PDF"
      accept=".pdf"
      endpoint="/api/import-pdf"
      chunkEndpoint="/api/import-pdf-chunk"
      infoText="Each PDF page becomes one image slide. Text is part of the image and cannot be edited in peydx. Depending on the file size, it may take some time."
      phaseLabels={{
        parsing: 'Rendering PDF…',
        media: 'Importing page {current}/{total}…',
      }}
    />
  )
}
