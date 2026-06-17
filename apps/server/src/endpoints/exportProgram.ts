import path from 'path'
import fs from 'fs'
import PptxGenJS from 'pptxgenjs'
import sharp from 'sharp'

export const exportProgram = {
  path: '/export-pptx/:id',
  method: 'get' as const,
  handler: async (req: any) => {
    if (!req.user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

    if ((req.user as any).collection === 'devices') {
      return Response.json({ error: 'Access denied' }, { status: 403 })
    }

    const programId = req.routeParams?.id
    if (!programId) {
      return Response.json({ error: 'Program ID required' }, { status: 400 })
    }

    let program: any
    try {
      program = await req.payload.findByID({
        collection: 'programs',
        id: programId,
        depth: 1,
      })
    } catch {
      return Response.json({ error: 'Program not found' }, { status: 404 })
    }

    const user = req.user as any
    if (user.role !== 'admin') {
      const deptIds = (user.departments || []).map((d: any) => (typeof d === 'object' ? d.id : d))
      const programDeptId = program?.folder?.department
      const programDeptIdNum = typeof programDeptId === 'object' ? programDeptId.id : programDeptId
      if (!programDeptIdNum || !deptIds.includes(programDeptIdNum)) {
        return Response.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    const slides = (program.slides || []).filter(
      (s: any) => s && s.blockType && s.id !== 'auto-end',
    )

    const flatSlides: any[] = []
    for (const slide of slides) {
      if (slide.blockType === 'segmentBlock') {
        for (const child of slide.slides || []) {
          if (child && child.blockType) {
            flatSlides.push({
              ...child,
              segmentContext: { name: slide.name, loop: slide.loop },
            })
          }
        }
      } else {
        flatSlides.push(slide)
      }
    }

    const PptxGenJSClass = (PptxGenJS as any).default ?? PptxGenJS
    const pres = new PptxGenJSClass()
    pres.title = program.title || 'Program'
    pres.author = 'Church Digital Signage'
    pres.layout = 'LAYOUT_WIDE'

    const mediaDir = path.resolve(process.cwd(), 'media')

    for (const slide of flatSlides) {
      try {
        await addSlideToPres(pres, slide, mediaDir)
      } catch (err) {
        console.warn(`Export: skipping slide (${slide.blockType}), error:`, err)
      }
    }

    if (
      program.autoBlackEndSlide &&
      !program.loop &&
      flatSlides.length > 0
    ) {
      const lastSlide = flatSlides[flatSlides.length - 1]
      if (lastSlide.blockType !== 'blackScreenBlock') {
        const autoEndSlide = pres.addSlide()
        autoEndSlide.background = { color: '000000' }
        autoEndSlide.addNotes(
          JSON.stringify({
            blockType: 'blackScreenBlock',
            advanceMode: 'manual',
            transition: 'fade',
            autoEnd: true,
          }),
        )
      }
    }

    const pptx = await pres.write({ outputType: 'nodebuffer' }) as Buffer

    const safeFilename = (program.title || 'program')
      .replace(/[^a-z0-9_-]/gi, '_')
      .substring(0, 100)

    return new Response(new Uint8Array(pptx), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${safeFilename}.pptx"`,
      },
    })
  },
}

async function addSlideToPres(pres: any, slide: any, mediaDir: string) {
  const notes = buildNotes(slide)

  if (slide.blockType === 'imageBlock') {
    const ppSlide = pres.addSlide()

    const mediaObj =
      slide.image && typeof slide.image === 'object' ? slide.image : null
    if (mediaObj?.filename) {
      try {
        const base64 = await loadImageBase64(mediaDir, mediaObj.filename)
        ppSlide.addImage({
          data: `image/png;base64,${base64}`,
          x: 0,
          y: 0,
          w: '100%',
          h: '100%',
        })
      } catch {
        notes.fileError = `File not found: ${mediaObj.filename}`
      }
    }
    ppSlide.addNotes(JSON.stringify(notes))
    return
  }

  if (slide.blockType === 'videoBlock') {
    const ppSlide = pres.addSlide()

    const videoObj =
      slide.video && typeof slide.video === 'object' ? slide.video : null
    if (videoObj?.filename) {
      if (videoObj.filename.includes('..') || path.isAbsolute(videoObj.filename)) {
        ppSlide.addNotes(JSON.stringify(notes))
        return
      }
      const thumbFile = `${videoObj.filename}_thumb.webp`
      try {
        const base64 = await loadImageBase64(mediaDir, thumbFile)
        ppSlide.addImage({
          data: `image/png;base64,${base64}`,
          x: 0,
          y: 0,
          w: '100%',
          h: '100%',
        })
      } catch {
        ppSlide.background = { color: '222222' }
      }

      const videoPath = path.resolve(mediaDir, videoObj.filename)
      try {
        if (fs.existsSync(videoPath) && fs.statSync(videoPath).size < 50 * 1024 * 1024) {
          const videoBuffer = fs.readFileSync(videoPath)
          const videoBase64 = videoBuffer.toString('base64')
          ppSlide.addMedia({
            data: `video/mp4;base64,${videoBase64}`,
            x: '2%',
            y: '2%',
            w: '96%',
            h: '96%',
          })
        }
      } catch {
        notes.fileError = `Video too large or unreadable: ${videoObj.filename}`
      }
    }
    ppSlide.addNotes(JSON.stringify(notes))
    return
  }

  if (slide.blockType === 'youtubeBlock') {
    const ppSlide = pres.addSlide()

    if (slide.youtubeId && /^[a-zA-Z0-9_-]{11}$/.test(slide.youtubeId)) {
      const thumbUrl = `https://img.youtube.com/vi/${slide.youtubeId}/maxresdefault.jpg`
      try {
        ppSlide.addImage({ path: thumbUrl, x: 0, y: 0, w: '100%', h: '100%' })
      } catch {
        ppSlide.background = { color: 'CC0000' }
      }
      ppSlide.addText(`https://youtu.be/${slide.youtubeId}`, {
        x: '10%',
        y: '85%',
        w: '80%',
        h: '10%',
        fontSize: 14,
        color: 'FFFFFF',
        align: 'center',
        shadow: { opacity: 80, blur: 4, offset: 1, color: '000000' },
      })
    }
    ppSlide.addNotes(JSON.stringify(notes))
    return
  }

  if (slide.blockType === 'audioBlock') {
    const ppSlide = pres.addSlide()
    ppSlide.background = { color: '333333' }
    ppSlide.addText('\u266A Audio Slide', {
      x: '10%',
      y: '40%',
      w: '80%',
      h: '20%',
      fontSize: 24,
      color: '999999',
      align: 'center',
    })

    const audioObj =
      slide.audio && typeof slide.audio === 'object' ? slide.audio : null
    if (audioObj?.filename) {
      if (audioObj.filename.includes('..') || path.isAbsolute(audioObj.filename)) {
        ppSlide.addNotes(JSON.stringify(notes))
        return
      }
      const audioPath = path.resolve(mediaDir, audioObj.filename)
      try {
        if (fs.existsSync(audioPath) && fs.statSync(audioPath).size < 10 * 1024 * 1024) {
          const audioBuffer = fs.readFileSync(audioPath)
          const audioBase64 = audioBuffer.toString('base64')
          const mimeType = audioObj.mimeType || 'audio/mpeg'
          ppSlide.addMedia({
            data: `${mimeType};base64,${audioBase64}`,
            x: 0,
            y: 0,
            w: 0,
            h: 0,
          })
        }
      } catch {
        notes.fileError = `Audio too large or unreadable: ${audioObj.filename}`
      }
    }
    ppSlide.addNotes(JSON.stringify(notes))
    return
  }

  if (slide.blockType === 'blackScreenBlock') {
    const ppSlide = pres.addSlide()
    ppSlide.background = { color: '000000' }
    ppSlide.addNotes(JSON.stringify(notes))
    return
  }
}

function buildNotes(slide: any): Record<string, any> {
  return {
    blockType: slide.blockType,
    advanceMode: slide.advanceMode,
    duration: slide.duration,
    transition: slide.transition,
    loop: slide.loop,
    mediaFilename:
      slide.image?.filename ||
      slide.video?.filename ||
      slide.audio?.filename ||
      null,
    mediaDuration:
      slide.video?.duration || slide.audio?.duration || null,
    youtubeId: slide.youtubeId || null,
    videoTitle: slide.videoTitle || null,
    segmentName: slide.segmentContext?.name || null,
  }
}

async function loadImageBase64(
  mediaDir: string,
  filename: string,
): Promise<string> {
  if (filename.includes('..') || path.isAbsolute(filename)) {
    throw new Error(`Invalid filename: ${filename}`)
  }
  const fullHDPath = path.resolve(mediaDir, 'sizes', 'fullHD', filename)
  const originalPath = path.resolve(mediaDir, filename)

  let imgPath: string | null = null
  if (fs.existsSync(fullHDPath)) {
    imgPath = fullHDPath
  } else if (fs.existsSync(originalPath)) {
    imgPath = originalPath
  }

  if (!imgPath) {
    throw new Error(`Image not found: ${filename}`)
  }

  const imgBuffer = fs.readFileSync(imgPath)
  const pngBuffer = await sharp(imgBuffer).png().toBuffer()
  return pngBuffer.toString('base64')
}
