import JSZip from 'jszip'
import { XMLParser } from 'fast-xml-parser'

const XML_PARSER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true,
}

export interface SlideSize {
  cx: number
  cy: number
}

export interface SlideMedia {
  relId: string
  sourceRelPath: string
  buffer: Buffer
  mimeType: string
  kind: 'image' | 'video' | 'audio'
  acrossSlides: number
  slideShapeIndex: number
  shapeId: number
  shapeName?: string
}

export interface ParsedSlide {
  images: SlideMedia[]
  videos: SlideMedia[]
  audios: SlideMedia[]
  hasFullScreenMedia: boolean
}

export interface ParsedPptx {
  fileName: string
  slideSize: SlideSize
  slides: ParsedSlide[]
  mediaRegistry: Map<string, Buffer>
  skipped: string[]
}

const COMPATIBLE_IMAGE_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/bmp',
  'image/webp', 'image/heic', 'image/heif',
])

const COMPATIBLE_AUDIO_TYPES = new Set([
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a',
  'audio/wav', 'audio/wave', 'audio/ogg', 'audio/aac',
])

const COMPATIBLE_VIDEO_TYPES = new Set([
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
])

export function isCompatibleCodec(mimeType: string): boolean {
  return COMPATIBLE_IMAGE_TYPES.has(mimeType)
    || COMPATIBLE_AUDIO_TYPES.has(mimeType)
    || COMPATIBLE_VIDEO_TYPES.has(mimeType)
}

export function emuToNumber(emuStr: string): number {
  return Number(emuStr)
}

export function isFullScreen(cx: number, cy: number, slideSize: SlideSize): boolean {
  const tolerance = 0.05
  return (
    Math.abs(cx - slideSize.cx) <= slideSize.cx * tolerance &&
    Math.abs(cy - slideSize.cy) <= slideSize.cy * tolerance
  )
}

function getAttr(obj: any, name: string): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined
  const key = `@_${name}`
  if (obj[key] !== undefined) return String(obj[key])
  for (const k of Object.keys(obj)) {
    const stripped = k.replace(/^@_/, '')
    if (stripped === name || stripped.endsWith(`:${name}`)) {
      return String(obj[k])
    }
  }
  return undefined
}

function extFromPath(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.')
  if (lastDot === -1) return ''
  return filePath.slice(lastDot + 1).toLowerCase()
}

function baseName(filePath: string): string {
  const lastSlash = filePath.lastIndexOf('/')
  if (lastSlash === -1) return filePath
  return filePath.slice(lastSlash + 1)
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp',
  heic: 'image/heic', heif: 'image/heif',
  svg: 'image/svg+xml', tiff: 'image/tiff', tif: 'image/tiff',
  emf: 'image/x-emf', wmf: 'image/x-wmf',
  mp3: 'audio/mpeg', mpeg: 'audio/mpeg', m4a: 'audio/mp4',
  wav: 'audio/wav', wave: 'audio/wave',
  ogg: 'audio/ogg', aac: 'audio/aac',
  wma: 'audio/x-ms-wma', mid: 'audio/midi', midi: 'audio/midi',
  mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo',
  webm: 'video/webm', ogv: 'video/ogg', wmv: 'video/x-ms-wmv',
  mkv: 'video/x-matroska',
}

export function detectMimeType(
  zipPath: string,
  contentTypes: Map<string, string>,
): string {
  if (contentTypes.has(zipPath)) {
    return contentTypes.get(zipPath)!
  }
  const ext = extFromPath(zipPath)
  if (contentTypes.has(ext)) {
    return contentTypes.get(ext)!
  }
  return MIME_BY_EXT[ext] || 'application/octet-stream'
}

function parseContentTypes(xml: string): Map<string, string> {
  const parser = new XMLParser(XML_PARSER_OPTIONS)
  const parsed = parser.parse(xml)
  const map = new Map<string, string>()
  const types = parsed?.Types
  if (!types) return map

  const defaults = types.Default
  if (defaults) {
    const arr = Array.isArray(defaults) ? defaults : [defaults]
    for (const d of arr) {
      const ext = getAttr(d, 'Extension')
      const ct = getAttr(d, 'ContentType')
      if (ext && ct) map.set(ext.toLowerCase(), ct)
    }
  }

  const overrides = types.Override
  if (overrides) {
    const arr = Array.isArray(overrides) ? overrides : [overrides]
    for (const o of arr) {
      const pn = getAttr(o, 'PartName')
      const ct = getAttr(o, 'ContentType')
      if (pn && ct) {
        const clean = pn.startsWith('/') ? pn.slice(1) : pn
        map.set(clean, ct)
      }
    }
  }

  return map
}

function parseRels(relsXml: string): Map<string, { target: string; type: string }> {
  const parser = new XMLParser(XML_PARSER_OPTIONS)
  const parsed = parser.parse(relsXml)
  const map = new Map<string, { target: string; type: string }>()
  const rels = parsed?.Relationships
  if (!rels) return map

  const items = rels.Relationship
  if (!items) return map

  const arr = Array.isArray(items) ? items : [items]
  for (const r of arr) {
    const id = getAttr(r, 'Id')
    const target = getAttr(r, 'Target')
    const type = getAttr(r, 'Type')
    if (id && target) {
      map.set(id, { target, type: type || '' })
    }
  }

  return map
}

function resolveRelTarget(
  relTarget: string,
  slideRelsDir: string,
): string {
  if (relTarget.startsWith('../')) {
    const parts = slideRelsDir.split('/').filter(Boolean)
    const relParts = relTarget.split('/')
    for (const part of relParts) {
      if (part === '..') {
        parts.pop()
      } else if (part !== '.') {
        parts.push(part)
      }
    }
    return parts.join('/')
  }
  return `${slideRelsDir}${relTarget}`
}

function parsePresentationXml(xml: string): {
  slideSize: SlideSize
  slideRelIds: string[]
} {
  const parser = new XMLParser(XML_PARSER_OPTIONS)
  const parsed = parser.parse(xml)
  const pres = parsed?.['p:presentation']
  if (!pres) throw new Error('Could not parse presentation.xml')

  const sldSz = pres?.['p:sldSz']
  const slideSize: SlideSize = {
    cx: sldSz ? emuToNumber(getAttr(sldSz, 'cx') || '0') : 9144000,
    cy: sldSz ? emuToNumber(getAttr(sldSz, 'cy') || '0') : 5143500,
  }

  const sldIdLst = pres?.['p:sldIdLst']
  const sldIdArr = sldIdLst?.['p:sldId']
  const slideRelIds: string[] = []
  if (sldIdArr) {
    const items = Array.isArray(sldIdArr) ? sldIdArr : [sldIdArr]
    for (const item of items) {
      const rId = getAttr(item, 'r:id')
      if (rId) slideRelIds.push(rId)
    }
  }

  return { slideSize, slideRelIds }
}

function walkTimingForNumSld(node: any): Map<number, number> {
  const result = new Map<number, number>()

  if (!node || typeof node !== 'object') return result

  const audio = node?.['p:audio']
  if (audio) {
    const cMediaNode = audio?.['p:cMediaNode']
    if (cMediaNode) {
      const numSldStr = getAttr(cMediaNode, 'numSld')
      const numSld = numSldStr ? parseInt(numSldStr, 10) : 0
      if (numSld > 1) {
        const tgtEl = cMediaNode?.['p:tgtEl']
        const spTgt = tgtEl?.['p:spTgt']
        if (spTgt) {
          const spidStr = getAttr(spTgt, 'spid')
          const spid = spidStr ? parseInt(spidStr, 10) : 0
          if (spid) result.set(spid, numSld)
        }
      }
    }
  }

  for (const key of Object.keys(node)) {
    if (key.startsWith('@_') || typeof node[key] === 'string' || typeof node[key] === 'number') continue
    const child = node[key]
    if (Array.isArray(child)) {
      for (const c of child) {
        for (const [k, v] of walkTimingForNumSld(c)) {
          result.set(k, v)
        }
      }
    } else if (typeof child === 'object' && child !== null) {
      for (const [k, v] of walkTimingForNumSld(child)) {
        result.set(k, v)
      }
    }
  }

  return result
}

function parseSlideXml(
  slideXml: string,
  relsXml: string,
  slideSize: SlideSize,
  mediaRegistry: Map<string, Buffer>,
  contentTypes: Map<string, string>,
  skipped: string[],
): ParsedSlide {
  const parser = new XMLParser(XML_PARSER_OPTIONS)
  const parsed = parser.parse(slideXml)
  const sld = parsed?.['p:sld']
  if (!sld) {
    return { images: [], videos: [], audios: [], hasFullScreenMedia: false }
  }

  const rels = parseRels(relsXml)
  const slideRelsDir = 'ppt/slides/'
  const timing = sld?.['p:timing']
  const numSldMap = timing ? walkTimingForNumSld(timing) : new Map()

  const cSld = sld?.['p:cSld']
  if (!cSld) {
    return { images: [], videos: [], audios: [], hasFullScreenMedia: false }
  }

  const images: SlideMedia[] = []
  const videos: SlideMedia[] = []
  const audios: SlideMedia[] = []
  let shapeIndex = 0

  const bg = cSld?.['p:bg']
  if (bg) {
    const bgPr = bg?.['p:bgPr']
    if (bgPr) {
      const blipFill = bgPr?.['a:blipFill']
      if (blipFill) {
        const blip = blipFill?.['a:blip']
        if (blip) {
          const embed = getAttr(blip, 'r:embed')
          if (embed) {
            const rel = rels.get(embed)
            if (rel) {
              const relPath = resolveRelTarget(rel.target, slideRelsDir)
              const buffer = mediaRegistry.get(relPath)
              if (buffer) {
                const mime = detectMimeType(relPath, contentTypes)
                if (isCompatibleCodec(mime)) {
                  images.push({
                    relId: embed,
                    sourceRelPath: relPath,
                    buffer,
                    mimeType: mime,
                    kind: 'image',
                    acrossSlides: 0,
                    slideShapeIndex: -1,
                    shapeId: -1,
                    shapeName: undefined,
                  })
                } else {
                  skipped.push(`Skipped incompatible background image: ${baseName(relPath)} (${mime})`)
                }
              }
            }
          }
        }
      }
    }
  }

  const spTree = cSld?.['p:spTree']
  if (spTree) {
    const picElements = spTree?.['p:pic']
    if (picElements) {
      const picArr = Array.isArray(picElements) ? picElements : [picElements]
      for (const pic of picArr) {
        if (!pic || typeof pic !== 'object') continue

        const nvPicPr = pic?.['p:nvPicPr']
        const cNvPr = nvPicPr?.['p:cNvPr']
        const shapeId = cNvPr ? (parseInt(getAttr(cNvPr, 'id') || '0', 10) || 0) : 0
        const shapeName = cNvPr ? getAttr(cNvPr, 'name') : undefined

        const spPr = pic?.['p:spPr']
        let cx = 0, cy = 0
        if (spPr) {
          const xfrm = spPr?.['a:xfrm']
          if (xfrm) {
            const ext = xfrm?.['a:ext']
            if (ext) {
              cx = emuToNumber(getAttr(ext, 'cx') || '0')
              cy = emuToNumber(getAttr(ext, 'cy') || '0')
            }
          }
        }

        if (!isFullScreen(cx, cy, slideSize)) {
          shapeIndex++
          continue
        }

        const blipFill = pic?.['p:blipFill']
        const blip = blipFill?.['a:blip']
        const embed = blip ? getAttr(blip, 'r:embed') : undefined

        const nvPr = nvPicPr?.['p:nvPr']
        const videoFile = nvPr?.['a:videoFile']
        const audioFile = nvPr?.['a:audioFile']

        if (videoFile) {
          const videoRId = getAttr(videoFile, 'r:link')
          if (videoRId) {
            const rel = rels.get(videoRId)
            if (rel) {
              const relPath = resolveRelTarget(rel.target, slideRelsDir)
              const buffer = mediaRegistry.get(relPath)
              if (buffer) {
                const mime = detectMimeType(relPath, contentTypes)
                if (isCompatibleCodec(mime)) {
                  videos.push({
                    relId: videoRId,
                    sourceRelPath: relPath,
                    buffer,
                    mimeType: mime,
                    kind: 'video',
                    acrossSlides: 0,
                    slideShapeIndex: shapeIndex,
                    shapeId,
                    shapeName,
                  })
                } else {
                  skipped.push(`Skipped incompatible video: ${baseName(relPath)} (${mime})`)
                }
              }
            }
          }
          shapeIndex++
          continue
        }

        if (audioFile) {
          const audioRId = getAttr(audioFile, 'r:link')
          if (audioRId) {
            const rel = rels.get(audioRId)
            if (rel) {
              const relPath = resolveRelTarget(rel.target, slideRelsDir)
              const buffer = mediaRegistry.get(relPath)
              if (buffer) {
                const mime = detectMimeType(relPath, contentTypes)
                if (isCompatibleCodec(mime)) {
                  const across = numSldMap.get(shapeId) || 0
                  audios.push({
                    relId: audioRId,
                    sourceRelPath: relPath,
                    buffer,
                    mimeType: mime,
                    kind: 'audio',
                    acrossSlides: across,
                    slideShapeIndex: shapeIndex,
                    shapeId,
                    shapeName,
                  })
                } else {
                  skipped.push(`Skipped incompatible audio: ${baseName(relPath)} (${mime})`)
                }
              }
            }
          }
          shapeIndex++
          continue
        }

        if (embed) {
          const rel = rels.get(embed)
          if (rel) {
            const relPath = resolveRelTarget(rel.target, slideRelsDir)
            const buffer = mediaRegistry.get(relPath)
            if (buffer) {
              const mime = detectMimeType(relPath, contentTypes)
              if (isCompatibleCodec(mime)) {
                images.push({
                  relId: embed,
                  sourceRelPath: relPath,
                  buffer,
                  mimeType: mime,
                  kind: 'image',
                  acrossSlides: 0,
                  slideShapeIndex: shapeIndex,
                  shapeId,
                  shapeName,
                })
              } else {
                skipped.push(`Skipped incompatible image: ${baseName(relPath)} (${mime})`)
              }
            }
          }
        }

        shapeIndex++
      }
    }
  }

  images.sort((a, b) => a.slideShapeIndex - b.slideShapeIndex)

  if (images.length > 1) {
    for (let i = 1; i < images.length; i++) {
      skipped.push(`Skipped additional full-screen image: ${baseName(images[i].sourceRelPath)} (keeping top-most only)`)
    }
    images.length = 1
  }

  return {
    images,
    videos,
    audios,
    hasFullScreenMedia: images.length > 0 || videos.length > 0 || audios.length > 0,
  }
}

function slidePathToRelsPath(slidePath: string): string {
  const lastSlash = slidePath.lastIndexOf('/')
  if (lastSlash === -1) return `_rels/${slidePath}.rels`
  const dir = slidePath.slice(0, lastSlash)
  const fname = slidePath.slice(lastSlash + 1)
  return `${dir}/_rels/${fname}.rels`
}

export async function parsePptx(buffer: Buffer): Promise<ParsedPptx> {
  const zip = await JSZip.loadAsync(buffer)

  const skipped: string[] = []

  const contentTypesXml = await zip.file('[Content_Types].xml')?.async('string')
  const contentTypes = contentTypesXml ? parseContentTypes(contentTypesXml) : new Map()

  const mediaRegistry = new Map<string, Buffer>()
  for (const [path, entry] of Object.entries(zip.files || {})) {
    if (path.startsWith('ppt/media/') && !entry.dir) {
      const buf = await entry.async('nodebuffer')
      const mime = detectMimeType(path, contentTypes)
      if (isCompatibleCodec(mime)) {
        mediaRegistry.set(path, buf)
      } else {
        skipped.push(`Skipped incompatible media: ${baseName(path)} (${mime})`)
      }
    }
  }

  const presXml = await zip.file('ppt/presentation.xml')?.async('string')
  if (!presXml) throw new Error('Could not find ppt/presentation.xml in the .pptx file')

  const { slideSize, slideRelIds } = parsePresentationXml(presXml)

  const presRelsXml = await zip.file('ppt/_rels/presentation.xml.rels')?.async('string')
  const presRels = presRelsXml ? parseRels(presRelsXml) : new Map()

  const slides: ParsedSlide[] = []
  for (const slideRelId of slideRelIds) {
    const slideRel = presRels.get(slideRelId)
    if (!slideRel) {
      skipped.push(`Could not resolve slide reference ${slideRelId}`)
      continue
    }
    const slidePath = `ppt/${slideRel.target}`
    const slideXml = await zip.file(slidePath)?.async('string')
    if (!slideXml) {
      skipped.push(`Could not read ${slidePath}`)
      continue
    }

    const relsPath = slidePathToRelsPath(slidePath)
    const relsXml = await zip.file(relsPath)?.async('string')
    if (!relsXml) {
      skipped.push(`Could not read ${relsPath}`)
    }

    const parsed = parseSlideXml(slideXml, relsXml || '', slideSize, mediaRegistry, contentTypes, skipped)
    slides.push(parsed)
  }

  return {
    fileName: 'presentation',
    slideSize,
    slides,
    mediaRegistry,
    skipped,
  }
}
