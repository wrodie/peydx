'use client'

import { ImportButton } from './ImportButton'

export function ImportPptxButton() {
  return (
    <ImportButton
      label="Import PPTX"
      accept=".pptx"
      endpoint="/api/import-pptx"
      chunkEndpoint="/api/import-pptx-chunk"
      infoText="This is a limited PPTX import. It will only import full-screen images, audio, and video files. It will not import text, shapes, or smaller graphics. Depending on the file size, it may take some time."
      phaseLabels={{
        parsing: 'Parsing PPTX…',
        media: 'Importing media {current}/{total}…',
      }}
    />
  )
}
