import { execFile } from 'node:child_process'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

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

function run(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`${cmd} failed: ${err.message || String(err)}`))
      } else {
        resolve({ stdout, stderr })
      }
    })
  })
}

export async function parsePdf(
  fileBuffer: Buffer,
  fileName: string,
  options?: { targetWidth?: number },
): Promise<ParsedPdf> {
  const targetWidth = options?.targetWidth ?? DEFAULT_TARGET_WIDTH

  const dir = await mkdtemp(path.join(tmpdir(), 'peydx-pdf-'))
  const inputPath = path.join(dir, 'input.pdf')

  try {
    await writeFile(inputPath, fileBuffer)

    const info = await run('pdfinfo', [inputPath])
    const pagesMatch = info.stdout.match(/^Pages:\s+(\d+)/m)
    const numPages = pagesMatch ? parseInt(pagesMatch[1], 10) : 0

    if (numPages === 0) {
      return { pages: [], skipped: [] }
    }

    const sizeMatch = info.stdout.match(/Page size:\s*([\d.]+)\s*x\s*([\d.]+)/)
    const widthPt = sizeMatch ? parseFloat(sizeMatch[1]) : 0

    let dpi = widthPt > 0 ? Math.round((targetWidth * 72) / widthPt) : 72
    if (!Number.isFinite(dpi) || dpi <= 0) {
      dpi = 72
    }

    const skipped: string[] = []
    const pages: PdfPage[] = []

    for (let pageNumber = 1; pageNumber <= numPages; pageNumber++) {
      const outRoot = path.join(dir, `page-${pageNumber}`)
      try {
        await run('pdftoppm', [
          '-png',
          '-singlefile',
          '-r',
          String(dpi),
          '-f',
          String(pageNumber),
          '-l',
          String(pageNumber),
          inputPath,
          outRoot,
        ])
        const buffer = await readFile(`${outRoot}.png`)
        pages.push({
          buffer,
          displayName: `${fileName} - Page ${pageNumber}`,
          fileName: `${fileName} - Page ${pageNumber}.png`,
          mimeType: 'image/png',
        })
      } catch (err: any) {
        skipped.push(`Failed to render page ${pageNumber}: ${err?.message || String(err)}`)
      }
    }

    return { pages, skipped }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
