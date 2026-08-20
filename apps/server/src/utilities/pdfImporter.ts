import { createCanvas, Path2D, ImageData, DOMMatrix } from '@napi-rs/canvas'

// pdf.js requires browser canvas globals that are not present in Node.
// @napi-rs/canvas provides compatible implementations — expose them globally
// before pdfjs-dist loads (it is lazily imported inside parsePdf).
;(globalThis as any).DOMMatrix = DOMMatrix
;(globalThis as any).ImageData = ImageData
;(globalThis as any).Path2D = Path2D

export interface PdfPage {
  buffer: Buffer
  displayName: string
  fileName: string
  mimeType: string
}

export interface ParsedPdf {
  pages: PdfPage[]
  skipped: string[]
}

const DEFAULT_TARGET_WIDTH = 1920
const CONCURRENCY = 4

// Some dependencies (e.g. drizzle-kit, loaded by @payloadcms/db-postgres during
// dev schema push) add enumerable properties to `Array.prototype` (e.g. `random`).
// pdf.js runs its worker on the main thread (`worker: null`) and refuses to start
// if `for...in` over an empty array finds any enumerable property. Make those
// properties non-enumerable (values are preserved, so dot-access still works).
function neutralizeArrayPrototypePollution(): void {
  const polluted: string[] = []
  for (const key in []) polluted.push(key)
  for (const key of polluted) {
    const desc = Object.getOwnPropertyDescriptor(Array.prototype, key)
    if (desc && desc.enumerable) {
      Object.defineProperty(Array.prototype, key, { ...desc, enumerable: false })
    }
  }
}

export async function parsePdf(
  fileBuffer: Buffer,
  fileName: string,
  options?: { targetWidth?: number },
): Promise<ParsedPdf> {
  const targetWidth = options?.targetWidth ?? DEFAULT_TARGET_WIDTH

  neutralizeArrayPrototypePollution()

  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')

  let doc: any
  try {
    doc = await getDocument({
      data: new Uint8Array(fileBuffer),
      worker: null as any,
    }).promise
  } catch (err: any) {
    throw new Error(`Could not open PDF: ${err?.message || String(err)}`)
  }

  const skipped: string[] = []
  const numPages = doc.numPages

  const results: (PdfPage | null)[] = new Array(numPages).fill(null)
  let nextPage = 1

  async function renderPage(pageNumber: number): Promise<PdfPage | null> {
    try {
      const page = await doc.getPage(pageNumber)
      const baseViewport = page.getViewport({ scale: 1 })
      const scale = targetWidth / baseViewport.width
      const viewport = page.getViewport({ scale })

      const width = Math.floor(viewport.width)
      const height = Math.floor(viewport.height)

      const canvas = createCanvas(width, height)
      const context = canvas.getContext('2d')

      await page.render({ canvasContext: context, viewport }).promise

      return {
        buffer: canvas.toBuffer('image/png'),
        displayName: `${fileName} - Page ${pageNumber}`,
        fileName: `${fileName} - Page ${pageNumber}.png`,
        mimeType: 'image/png',
      }
    } catch (err: any) {
      skipped.push(`Failed to render page ${pageNumber}: ${err?.message || String(err)}`)
      return null
    }
  }

  async function worker() {
    while (true) {
      const pageNumber = nextPage++
      if (pageNumber > numPages) return
      results[pageNumber - 1] = await renderPage(pageNumber)
    }
  }

  const workerCount = Math.min(CONCURRENCY, numPages)
  const workers: Promise<void>[] = []
  for (let i = 0; i < workerCount; i++) {
    workers.push(worker())
  }
  await Promise.all(workers)

  const pages: PdfPage[] = []
  for (const r of results) {
    if (r) pages.push(r)
  }

  return { pages, skipped }
}
