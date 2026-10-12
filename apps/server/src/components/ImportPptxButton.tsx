'use client'

import { ImportButton } from './ImportButton'
import { PptxFileIcon } from './icons'

export function ImportPptxButton({ collectionSlug }: { collectionSlug: 'media' | 'programs' }) {
  return (
    <ImportButton
      label="Import PPTX"
      accept=".pptx"
      endpoint="/api/import-pptx"
      chunkEndpoint="/api/import-pptx-chunk"
      collectionSlug={collectionSlug}
      icon={<PptxFileIcon size={14} />}
      order={2}
      infoText="This is a limited PPTX import. It will only import full-screen images, audio, and video files. It will not import text, shapes, or smaller graphics. Depending on the file size, it may take some time."
      phaseLabels={{
        parsing: 'Parsing PPTX…',
        media: 'Importing media {current}/{total}…',
      }}
    />
  )
}
