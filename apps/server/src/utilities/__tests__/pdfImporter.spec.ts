import { describe, it, expect, vi, beforeEach } from 'vitest'
import sharp from 'sharp'

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', async (importOriginal) => {
  const actual = await importOriginal<any>()
  return {
    ...actual,
    getDocument: vi.fn(actual.getDocument),
  }
})

import { parsePdf } from '../pdfImporter'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

function buildMinimalPdf(pageCount: number): Buffer {
  const objects: string[] = []
  objects.push('<< /Type /Catalog /Pages 2 0 R >>')
  const kids = Array.from({ length: pageCount }, (_, i) => `${3 + i * 2} 0 R`).join(' ')
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`)

  for (let i = 0; i < pageCount; i++) {
    const pageObjNum = 3 + i * 2
    const contentsObjNum = pageObjNum + 1
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 320 180] /Resources << >> /Contents ${contentsObjNum} 0 R >>`)
    const stream = '0 0 320 180 re\n0.5 0 0.5 rg\nf\n'
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`)
  }

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'))
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
  })

  const xrefOffset = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (const off of offsets) {
    pdf += `${String(off).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`

  return Buffer.from(pdf, 'latin1')
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47])

async function buildPdfWithEmbeddedImage(): Promise<Buffer> {
  const jpeg = await sharp({
    create: { width: 8, height: 8, channels: 3, background: { r: 255, g: 0, b: 0 } },
  }).jpeg().toBuffer()

  const contentStream = 'q 320 0 0 180 0 0 cm /Im0 Do Q\n'
  const imgHeader = `<< /Type /XObject /Subtype /Image /Width 8 /Height 8 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`

  const bodies: Buffer[] = [
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>', 'latin1'),
    Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>', 'latin1'),
    Buffer.from('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 320 180] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>', 'latin1'),
    Buffer.from(`<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream`, 'latin1'),
    Buffer.concat([
      Buffer.from(imgHeader, 'latin1'),
      jpeg,
      Buffer.from('\nendstream', 'latin1'),
    ]),
  ]

  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n', 'latin1')]
  const offsets: number[] = []
  let length = chunks[0].length
  for (let i = 0; i < bodies.length; i++) {
    offsets.push(length)
    const objHeader = Buffer.from(`${i + 1} 0 obj\n`, 'latin1')
    const objFooter = Buffer.from('\nendobj\n', 'latin1')
    chunks.push(objHeader, bodies[i], objFooter)
    length += objHeader.length + bodies[i].length + objFooter.length
  }

  const xrefOffset = length
  let xref = `xref\n0 ${bodies.length + 1}\n`
  xref += '0000000000 65535 f \n'
  for (const off of offsets) {
    xref += `${String(off).padStart(10, '0')} 00000 n \n`
  }
  xref += `trailer\n<< /Size ${bodies.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  chunks.push(Buffer.from(xref, 'latin1'))

  return Buffer.concat(chunks)
}

function pngSize(buf: Buffer): { width: number; height: number } {
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  }
}

describe('parsePdf', () => {
  beforeEach(() => {
    vi.mocked(getDocument).mockClear()
  })

  it('renders all pages to PNG buffers', async () => {
    const pdf = buildMinimalPdf(2)
    const parsed = await parsePdf(pdf, 'test', { targetWidth: 320 })

    expect(parsed.pages).toHaveLength(2)
    expect(parsed.skipped).toHaveLength(0)
    for (const page of parsed.pages) {
      expect(page.buffer.subarray(0, 4).equals(PNG_MAGIC)).toBe(true)
      expect(page.mimeType).toBe('image/png')
    }
  })

  it('sets correct display/file names', async () => {
    const pdf = buildMinimalPdf(2)
    const parsed = await parsePdf(pdf, 'test', { targetWidth: 320 })

    expect(parsed.pages[0].displayName).toBe('test - Page 1')
    expect(parsed.pages[0].fileName).toBe('test - Page 1.png')
    expect(parsed.pages[1].displayName).toBe('test - Page 2')
    expect(parsed.pages[1].fileName).toBe('test - Page 2.png')
  })

  it('respects targetWidth option', async () => {
    const pdf = buildMinimalPdf(1)
    const parsed = await parsePdf(pdf, 'test', { targetWidth: 800 })

    expect(parsed.pages).toHaveLength(1)
    const { width, height } = pngSize(parsed.pages[0].buffer)
    expect(width).toBe(800)
    expect(height).toBe(450)
  })

  it('handles empty PDF (0 pages)', async () => {
    const pdf = buildMinimalPdf(0)
    const parsed = await parsePdf(pdf, 'test')

    expect(parsed.pages).toHaveLength(0)
    expect(parsed.skipped).toHaveLength(0)
  })

  it('renders pages with embedded images', async () => {
    const pdf = await buildPdfWithEmbeddedImage()
    const parsed = await parsePdf(pdf, 'test', { targetWidth: 320 })

    expect(parsed.pages).toHaveLength(1)
    expect(parsed.skipped).toHaveLength(0)
    expect(parsed.pages[0].buffer.subarray(0, 4).equals(PNG_MAGIC)).toBe(true)
  })

  it('renders even when Array.prototype is polluted with enumerable properties', async () => {
    const original = Object.getOwnPropertyDescriptor(Array.prototype, 'random')
    ;(Array.prototype as any).random = function () {
      return this[0]
    }

    try {
      const pdf = buildMinimalPdf(1)
      const parsed = await parsePdf(pdf, 'test', { targetWidth: 320 })

      expect(parsed.pages).toHaveLength(1)
      expect(parsed.skipped).toHaveLength(0)
      expect(parsed.pages[0].buffer.subarray(0, 4).equals(PNG_MAGIC)).toBe(true)
    } finally {
      if (original) {
        Object.defineProperty(Array.prototype, 'random', original)
      } else {
        delete (Array.prototype as any).random
      }
    }
  })

  it('skips pages that fail to render', async () => {
    const fakeDoc = {
      numPages: 2,
      getPage: vi.fn(async (n: number) => {
        const fail = n === 2
        return {
          getViewport: ({ scale }: any) => ({ width: 320 * scale, height: 180 * scale }),
          render: () => ({
            promise: fail
              ? Promise.reject(new Error('render boom'))
              : Promise.resolve(),
          }),
        }
      }),
    }

    vi.mocked(getDocument).mockImplementationOnce((() => ({
      promise: Promise.resolve(fakeDoc),
    })) as any)

    const pdf = buildMinimalPdf(2)
    const parsed = await parsePdf(pdf, 'test', { targetWidth: 320 })

    expect(parsed.pages).toHaveLength(1)
    expect(parsed.skipped).toHaveLength(1)
    expect(parsed.skipped[0]).toContain('page 2')
  })
})
