import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = vi.hoisted(() => {
  const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ONE_PX_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )

  function buildPng(width: number, height: number): Buffer {
    const buf = Buffer.from(ONE_PX_PNG)
    buf.writeUInt32BE(width, 16)
    buf.writeUInt32BE(height, 20)
    return buf
  }

  return {
    pdfinfoPages: 2,
    pdfinfoSizePt: { width: 320, height: 180 },
    failPage: null as number | null,
    buildPng,
  }
})

vi.mock('node:child_process', () => {
  return {
    execFile: vi.fn(async (cmd: string, args: string[], _opts: any, cb: any) => {
      const { writeFile } = await import('node:fs/promises')

      if (cmd === 'pdfinfo') {
        cb(
          null,
          `Pages:          ${state.pdfinfoPages}\nPage size:      ${state.pdfinfoSizePt.width} x ${state.pdfinfoSizePt.height} pts`,
          '',
        )
        return
      }

      if (cmd === 'pdftoppm') {
        const dpi = Number(args[args.indexOf('-r') + 1])
        const fPage = Number(args[args.indexOf('-f') + 1])
        const root = args[args.length - 1]

        if (state.failPage === fPage) {
          cb(new Error('render boom'), '', 'render boom')
          return
        }

        const width = Math.round((state.pdfinfoSizePt.width * dpi) / 72)
        const height = Math.round((state.pdfinfoSizePt.height * dpi) / 72)
        await writeFile(`${root}.png`, state.buildPng(width, height))
        cb(null, '', '')
        return
      }

      cb(new Error(`unexpected cmd ${cmd}`), '', '')
    }),
  }
})

import { execFile } from 'node:child_process'
import { parsePdf } from '../pdfImporter'

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47])

function pngSize(buf: Buffer): { width: number; height: number } {
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  }
}

describe('parsePdf', () => {
  beforeEach(() => {
    vi.mocked(execFile).mockClear()
    state.pdfinfoPages = 2
    state.pdfinfoSizePt = { width: 320, height: 180 }
    state.failPage = null
  })

  it('renders all pages to PNG buffers', async () => {
    const parsed = await parsePdf(Buffer.from('%PDF-fake'), 'test', { targetWidth: 320 })

    expect(parsed.pages).toHaveLength(2)
    expect(parsed.skipped).toHaveLength(0)
    for (const page of parsed.pages) {
      expect(page.buffer.subarray(0, 4).equals(PNG_MAGIC)).toBe(true)
      expect(page.mimeType).toBe('image/png')
    }
  })

  it('sets correct display/file names', async () => {
    const parsed = await parsePdf(Buffer.from('%PDF-fake'), 'test', { targetWidth: 320 })

    expect(parsed.pages[0].displayName).toBe('test - Page 1')
    expect(parsed.pages[0].fileName).toBe('test - Page 1.png')
    expect(parsed.pages[1].displayName).toBe('test - Page 2')
    expect(parsed.pages[1].fileName).toBe('test - Page 2.png')
  })

  it('respects targetWidth option', async () => {
    state.pdfinfoPages = 1
    const parsed = await parsePdf(Buffer.from('%PDF-fake'), 'test', { targetWidth: 800 })

    expect(parsed.pages).toHaveLength(1)
    const { width, height } = pngSize(parsed.pages[0].buffer)
    expect(width).toBe(800)
    expect(height).toBe(450)
  })

  it('handles empty PDF (0 pages)', async () => {
    state.pdfinfoPages = 0
    const parsed = await parsePdf(Buffer.from('%PDF-fake'), 'test')

    expect(parsed.pages).toHaveLength(0)
    expect(parsed.skipped).toHaveLength(0)
    expect(vi.mocked(execFile)).not.toHaveBeenCalledWith(
      'pdftoppm',
      expect.anything(),
      expect.anything(),
      expect.anything(),
    )
  })

  it('skips pages that fail to render', async () => {
    state.failPage = 2
    const parsed = await parsePdf(Buffer.from('%PDF-fake'), 'test', { targetWidth: 320 })

    expect(parsed.pages).toHaveLength(1)
    expect(parsed.skipped).toHaveLength(1)
    expect(parsed.skipped[0]).toContain('page 2')
  })
})
