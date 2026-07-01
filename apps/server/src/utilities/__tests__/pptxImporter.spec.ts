import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import {
  isFullScreen,
  emuToNumber,
  isCompatibleCodec,
  detectMimeType,
  parsePptx,
  type SlideSize,
} from '../pptxImporter'

describe('emuToNumber', () => {
  it('converts string to number', () => {
    expect(emuToNumber('12192000')).toBe(12192000)
  })

  it('converts zero string to 0', () => {
    expect(emuToNumber('0')).toBe(0)
  })

  it('converts large EMU values', () => {
    expect(emuToNumber('6858000')).toBe(6858000)
  })
})

describe('isFullScreen', () => {
  const slideSize: SlideSize = { cx: 12192000, cy: 6858000 }

  it('matches exact slide size', () => {
    expect(isFullScreen(12192000, 6858000, slideSize)).toBe(true)
  })

  it('tolerates 5% variation on both dimensions', () => {
    const cx = Math.round(12192000 * 0.97)
    const cy = Math.round(6858000 * 0.96)
    expect(isFullScreen(cx, cy, slideSize)).toBe(true)
  })

  it('tolerates 5% larger on both dimensions', () => {
    const cx = Math.round(12192000 * 1.03)
    const cy = Math.round(6858000 * 1.04)
    expect(isFullScreen(cx, cy, slideSize)).toBe(true)
  })

  it('rejects small pictures', () => {
    expect(isFullScreen(3000000, 2000000, slideSize)).toBe(false)
  })

  it('rejects if only one dimension is full', () => {
    expect(isFullScreen(12192000, 2000000, slideSize)).toBe(false)
  })

  it('rejects zero dimensions', () => {
    expect(isFullScreen(0, 0, slideSize)).toBe(false)
  })

  it('tolerates exactly 5% boundary', () => {
    const cx = Math.round(12192000 * 0.95)
    const cy = Math.round(6858000 * 0.95)
    expect(isFullScreen(cx, cy, slideSize)).toBe(true)
  })

  it('rejects just beyond 5% boundary', () => {
    const cx = Math.round(12192000 * 0.949)
    const cy = Math.round(6858000 * 0.949)
    expect(isFullScreen(cx, cy, slideSize)).toBe(false)
  })
})

describe('isCompatibleCodec', () => {
  it('accepts JPEG', () => {
    expect(isCompatibleCodec('image/jpeg')).toBe(true)
  })

  it('accepts PNG', () => {
    expect(isCompatibleCodec('image/png')).toBe(true)
  })

  it('accepts GIF', () => {
    expect(isCompatibleCodec('image/gif')).toBe(true)
  })

  it('accepts MP4', () => {
    expect(isCompatibleCodec('video/mp4')).toBe(true)
  })

  it('accepts WebM', () => {
    expect(isCompatibleCodec('video/webm')).toBe(true)
  })

  it('accepts MP3', () => {
    expect(isCompatibleCodec('audio/mpeg')).toBe(true)
  })

  it('accepts WAV', () => {
    expect(isCompatibleCodec('audio/wav')).toBe(true)
  })

  it('rejects EMF', () => {
    expect(isCompatibleCodec('image/x-emf')).toBe(false)
  })

  it('rejects WMF', () => {
    expect(isCompatibleCodec('image/x-wmf')).toBe(false)
  })

  it('rejects WMV', () => {
    expect(isCompatibleCodec('video/x-ms-wmv')).toBe(false)
  })

  it('rejects application/octet-stream', () => {
    expect(isCompatibleCodec('application/octet-stream')).toBe(false)
  })
})

describe('detectMimeType', () => {
  it('uses content type override by path', () => {
    const ct = new Map([['ppt/media/image1.png', 'image/png']])
    expect(detectMimeType('ppt/media/image1.png', ct)).toBe('image/png')
  })

  it('uses content type default by extension', () => {
    const ct = new Map([['jpeg', 'image/jpeg']])
    expect(detectMimeType('ppt/media/photo.jpeg', ct)).toBe('image/jpeg')
  })

  it('falls back to built-in extension map', () => {
    const ct = new Map()
    expect(detectMimeType('ppt/media/video.mp4', ct)).toBe('video/mp4')
  })

  it('returns octet-stream for unknown extension', () => {
    const ct = new Map()
    expect(detectMimeType('ppt/media/file.xyz', ct)).toBe('application/octet-stream')
  })
})

async function buildMinimalPptx(presRels: { target: string; id: string }[], slides: { xml: string; rels: string }[], media: { path: string; data: Buffer }[]): Promise<Buffer> {
  const zip = new JSZip()

  const rels = presRels
    .map(r => `<Relationship Id="${r.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="${r.target}"/>`)
    .join('')

  zip.file('[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="jpeg" ContentType="image/jpeg"/>' +
    '<Default Extension="mp4" ContentType="video/mp4"/>' +
    '<Default Extension="mp3" ContentType="audio/mpeg"/>' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '</Types>'
  )

  zip.file('ppt/_rels/presentation.xml.rels',
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    rels +
    '</Relationships>'
  )

  const sldIds = presRels
    .map((r, i) => `<p:sldId id="${256 + i}" r:id="${r.id}"/>`)
    .join('')

  zip.file('ppt/presentation.xml',
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"' +
    ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"' +
    ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<p:sldSz cx="12192000" cy="6858000"/>' +
    '<p:sldIdLst>' + sldIds + '</p:sldIdLst>' +
    '</p:presentation>'
  )

  for (let i = 0; i < slides.length; i++) {
    const s = slides[i]
    const slideNum = i + 1
    zip.file(`ppt/slides/slide${slideNum}.xml`, s.xml)
    zip.file(`ppt/slides/_rels/slide${slideNum}.xml.rels`, s.rels)
  }

  for (const m of media) {
    zip.file(m.path, m.data)
  }

  return Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }))
}

const SLIDE_TEMPLATE = {
  header: '<?xml version="1.0" encoding="UTF-8"?>' +
    '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"' +
    ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"' +
    ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
  footer: '</p:sld>',
  cSldOpen: '<p:cSld>',
  cSldClose: '</p:cSld>',
  spTreeOpen: '<p:spTree>',
  spTreeClose: '</p:spTree>',
}

function makeSlideXml(children: string): string {
  return `${SLIDE_TEMPLATE.header}${SLIDE_TEMPLATE.cSldOpen}${SLIDE_TEMPLATE.spTreeOpen}${children}${SLIDE_TEMPLATE.spTreeClose}${SLIDE_TEMPLATE.cSldClose}${SLIDE_TEMPLATE.footer}`
}

function makeFullScreenImagePic(rId: string, id: number): string {
  return `<p:pic>
    <p:nvPicPr><p:cNvPr id="${id}" name="Picture ${id}"/><p:nvPr/></p:nvPicPr>
    <p:blipFill><a:blip r:embed="${rId}"/></p:blipFill>
    <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="12192000" cy="6858000"/></a:xfrm></p:spPr>
  </p:pic>`
}

function makeSmallImagePic(rId: string, id: number): string {
  return `<p:pic>
    <p:nvPicPr><p:cNvPr id="${id}" name="Small ${id}"/><p:nvPr/></p:nvPicPr>
    <p:blipFill><a:blip r:embed="${rId}"/></p:blipFill>
    <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="3000000" cy="2000000"/></a:xfrm></p:spPr>
  </p:pic>`
}

function makeVideoPic(mediaRId: string, posterRId: string, id: number): string {
  return `<p:pic>
    <p:nvPicPr><p:cNvPr id="${id}" name="Video ${id}"/><p:nvPr><a:videoFile r:link="${mediaRId}"/></p:nvPr></p:nvPicPr>
    <p:blipFill><a:blip r:embed="${posterRId}"/></p:blipFill>
    <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="12192000" cy="6858000"/></a:xfrm></p:spPr>
  </p:pic>`
}

function makeAudioPic(mediaRId: string, posterRId: string, id: number): string {
  return `<p:pic>
    <p:nvPicPr><p:cNvPr id="${id}" name="Audio ${id}"/><p:nvPr><a:audioFile r:link="${mediaRId}"/></p:nvPr></p:nvPicPr>
    <p:blipFill><a:blip r:embed="${posterRId}"/></p:blipFill>
    <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="12192000" cy="6858000"/></a:xfrm></p:spPr>
  </p:pic>`
}

function makeBgSlideXml(bgRId: string): string {
  return '<?xml version="1.0" encoding="UTF-8"?>' +
    '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"' +
    ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"' +
    ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<p:cSld>' +
    '<p:bg><p:bgPr><a:blipFill><a:blip r:embed="' + bgRId + '"/></a:blipFill></p:bgPr></p:bg>' +
    '<p:spTree/>' +
    '</p:cSld>' +
    '</p:sld>'
}

function makeRels(items: { id: string; type: string; target: string }[]): string {
  const relsXml = items
    .map(r => `<Relationship Id="${r.id}" Type="${r.type}" Target="${r.target}"/>`)
    .join('')
  return '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    relsXml +
    '</Relationships>'
}

describe('parsePptx', () => {
  it('extracts a full-screen image', async () => {
    const imgBuf = Buffer.from('fake-jpeg-data')
    const pptx = await buildMinimalPptx(
      [{ id: 'rId1', target: 'slides/slide1.xml' }],
      [{
        xml: makeSlideXml(makeFullScreenImagePic('rId1', 1)),
        rels: makeRels([
          { id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', target: '../media/image1.jpeg' },
        ]),
      }],
      [{ path: 'ppt/media/image1.jpeg', data: imgBuf }],
    )

    const parsed = await parsePptx(pptx)
    expect(parsed.slides).toHaveLength(1)
    expect(parsed.slides[0].images).toHaveLength(1)
    expect(parsed.slides[0].images[0].kind).toBe('image')
    expect(parsed.slides[0].images[0].mimeType).toBe('image/jpeg')
    expect(parsed.mediaRegistry.has('ppt/media/image1.jpeg')).toBe(true)
  })

  it('skips a small picture', async () => {
    const imgBuf = Buffer.from('fake-data')
    const pptx = await buildMinimalPptx(
      [{ id: 'rId1', target: 'slides/slide1.xml' }],
      [{
        xml: makeSlideXml(makeSmallImagePic('rId1', 1)),
        rels: makeRels([
          { id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', target: '../media/small.jpeg' },
        ]),
      }],
      [{ path: 'ppt/media/small.jpeg', data: imgBuf }],
    )

    const parsed = await parsePptx(pptx)
    expect(parsed.slides[0].images).toHaveLength(0)
    expect(parsed.slides[0].videos).toHaveLength(0)
  })

  it('detects a video placeholder', async () => {
    const videoBuf = Buffer.from('fake-mp4-data')
    const posterBuf = Buffer.from('fake-poster-data')
    const pptx = await buildMinimalPptx(
      [{ id: 'rId1', target: 'slides/slide1.xml' }],
      [{
        xml: makeSlideXml(makeVideoPic('rId2', 'rId1', 1)),
        rels: makeRels([
          { id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', target: '../media/poster.jpeg' },
          { id: 'rId2', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/video', target: '../media/video.mp4' },
        ]),
      }],
      [
        { path: 'ppt/media/poster.jpeg', data: posterBuf },
        { path: 'ppt/media/video.mp4', data: videoBuf },
      ],
    )

    const parsed = await parsePptx(pptx)
    expect(parsed.slides[0].videos).toHaveLength(1)
    expect(parsed.slides[0].videos[0].kind).toBe('video')
    expect(parsed.slides[0].videos[0].mimeType).toBe('video/mp4')
  })

  it('detects an audio placeholder', async () => {
    const audioBuf = Buffer.from('fake-mp3-data')
    const pptx = await buildMinimalPptx(
      [{ id: 'rId1', target: 'slides/slide1.xml' }],
      [{
        xml: makeSlideXml(makeAudioPic('rId1', '__none__', 1)),
        rels: makeRels([
          { id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/audio', target: '../media/music.mp3' },
        ]),
      }],
      [{ path: 'ppt/media/music.mp3', data: audioBuf }],
    )

    const parsed = await parsePptx(pptx)
    expect(parsed.slides[0].audios).toHaveLength(1)
    expect(parsed.slides[0].audios[0].kind).toBe('audio')
    expect(parsed.slides[0].audios[0].mimeType).toBe('audio/mpeg')
    expect(parsed.slides[0].audios[0].acrossSlides).toBe(0)
  })

  it('detects background image via p:bg', async () => {
    const imgBuf = Buffer.from('fake-bg-data')
    const pptx = await buildMinimalPptx(
      [{ id: 'rId1', target: 'slides/slide1.xml' }],
      [{
        xml: makeBgSlideXml('rId1'),
        rels: makeRels([
          { id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', target: '../media/bg.jpeg' },
        ]),
      }],
      [{ path: 'ppt/media/bg.jpeg', data: imgBuf }],
    )

    const parsed = await parsePptx(pptx)
    expect(parsed.slides[0].images).toHaveLength(1)
    expect(parsed.slides[0].images[0].slideShapeIndex).toBe(-1)
  })

  it('parses numSld from timing tree for across-slides audio', async () => {
    const audioBuf = Buffer.from('fake-audio-data')
    const posterBuf = Buffer.from('fake-poster-data')

    const slideXml = '<?xml version="1.0" encoding="UTF-8"?>' +
      '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"' +
      ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"' +
      ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<p:cSld><p:spTree>' +
      makeAudioPic('rId1', '__none__', 4) +
      '</p:spTree></p:cSld>' +
      '<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite">' +
      '<p:childTnLst><p:seq><p:cTn id="2" dur="indefinite">' +
      '<p:childTnLst><p:parallel><p:cTn id="3" dur="indefinite">' +
      '<p:childTnLst>' +
      '<p:audio><p:cMediaNode numSld="3"><p:tgtEl><p:spTgt spid="4"/></p:tgtEl></p:cMediaNode></p:audio>' +
      '</p:childTnLst>' +
      '</p:cTn></p:parallel></p:childTnLst>' +
      '</p:cTn></p:seq></p:childTnLst>' +
      '</p:cTn></p:par></p:tnLst></p:timing>' +
      '</p:sld>'

    const pptx = await buildMinimalPptx(
      [{ id: 'rId1', target: 'slides/slide1.xml' }],
      [{
        xml: slideXml,
        rels: makeRels([
          { id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/audio', target: '../media/audio.mp3' },
        ]),
      }],
      [{ path: 'ppt/media/audio.mp3', data: audioBuf }],
    )

    const parsed = await parsePptx(pptx)
    expect(parsed.slides[0].audios).toHaveLength(1)
    expect(parsed.slides[0].audios[0].acrossSlides).toBe(3)
  })

  it('handles multiple slides in order', async () => {
    const img1 = Buffer.from('img1')
    const img2 = Buffer.from('img2')
    const pptx = await buildMinimalPptx(
      [
        { id: 'rId1', target: 'slides/slide1.xml' },
        { id: 'rId2', target: 'slides/slide2.xml' },
      ],
      [
        {
          xml: makeSlideXml(makeFullScreenImagePic('rId1', 1)),
          rels: makeRels([
            { id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', target: '../media/img1.jpeg' },
          ]),
        },
        {
          xml: makeSlideXml(makeFullScreenImagePic('rId1', 1)),
          rels: makeRels([
            { id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', target: '../media/img2.jpeg' },
          ]),
        },
      ],
      [
        { path: 'ppt/media/img1.jpeg', data: img1 },
        { path: 'ppt/media/img2.jpeg', data: img2 },
      ],
    )

    const parsed = await parsePptx(pptx)
    expect(parsed.slides).toHaveLength(2)
    expect(parsed.slides[0].images).toHaveLength(1)
    expect(parsed.slides[1].images).toHaveLength(1)
  })

  it('skips incompatible codec media', async () => {
    const wmfBuf = Buffer.from('fake-wmf')
    const pptx = await buildMinimalPptx(
      [{ id: 'rId1', target: 'slides/slide1.xml' }],
      [{
        xml: makeSlideXml(makeFullScreenImagePic('rId1', 1)),
        rels: makeRels([
          { id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', target: '../media/graphic.wmf' },
        ]),
      }],
      [{ path: 'ppt/media/graphic.wmf', data: wmfBuf }],
    )

    const parsed = await parsePptx(pptx)
    expect(parsed.mediaRegistry.has('ppt/media/graphic.wmf')).toBe(false)
    expect(parsed.skipped.some(s => s.includes('graphic.wmf'))).toBe(true)
  })

  it('handles slide with only text (no media)', async () => {
    const textXml = '<?xml version="1.0" encoding="UTF-8"?>' +
      '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"' +
      ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
      '<p:cSld><p:spTree>' +
      '<p:sp><p:nvSpPr><p:cNvPr id="2" name="TextBox"/></p:nvSpPr>' +
      '<p:spPr><a:xfrm><a:off x="1000000" y="1000000"/><a:ext cx="8000000" cy="2000000"/></a:xfrm></p:spPr>' +
      '<p:txBody><a:bodyPr/><a:p><a:r><a:t>Hello</a:t></a:r></a:p></p:txBody>' +
      '</p:sp></p:spTree></p:cSld></p:sld>'

    const pptx = await buildMinimalPptx(
      [{ id: 'rId1', target: 'slides/slide1.xml' }],
      [{ xml: textXml, rels: makeRels([]) }],
      [],
    )

    const parsed = await parsePptx(pptx)
    expect(parsed.slides).toHaveLength(1)
    expect(parsed.slides[0].hasFullScreenMedia).toBe(false)
    expect(parsed.slides[0].images).toHaveLength(0)
  })

  it('keeps only first full-screen image when multiple exist', async () => {
    const img1 = Buffer.from('img1')
    const img2 = Buffer.from('img2')
    const slideXml = makeSlideXml(
      makeFullScreenImagePic('rId1', 1) +
      makeFullScreenImagePic('rId2', 2)
    )
    const pptx = await buildMinimalPptx(
      [{ id: 'rId1', target: 'slides/slide1.xml' }],
      [{
        xml: slideXml,
        rels: makeRels([
          { id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', target: '../media/img1.jpeg' },
          { id: 'rId2', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', target: '../media/img2.jpeg' },
        ]),
      }],
      [
        { path: 'ppt/media/img1.jpeg', data: img1 },
        { path: 'ppt/media/img2.jpeg', data: img2 },
      ],
    )

    const parsed = await parsePptx(pptx)
    expect(parsed.slides[0].images).toHaveLength(1)
    expect(parsed.skipped.some(s => s.includes('Skipped additional'))).toBe(true)
  })

  it('handles empty pptx with no slides', async () => {
    const zip = new JSZip()
    zip.file('[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '</Types>'
    )
    zip.file('ppt/_rels/presentation.xml.rels',
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '</Relationships>'
    )
    zip.file('ppt/presentation.xml',
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
      '<p:sldSz cx="12192000" cy="6858000"/>' +
      '<p:sldIdLst/>' +
      '</p:presentation>'
    )
    const buf = Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }))

    const parsed = await parsePptx(buf)
    expect(parsed.slides).toHaveLength(0)
    expect(parsed.slideSize.cx).toBe(12192000)
    expect(parsed.slideSize.cy).toBe(6858000)
  })
})
