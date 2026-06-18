const path = require('path')
const fs = require('fs')

function sanitizeFilename(filename) {
  return filename
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '')
}

function resolveSlideMedia(slide) {
  if (slide.blockType === 'segmentBlock') {
    slide.slides = (slide.slides || []).map(resolveSlideMedia)
    if (slide.backgroundAudio && typeof slide.backgroundAudio === 'object') {
      slide.backgroundAudio = {
        ...slide.backgroundAudio,
        url: slide.backgroundAudio.url
          ? `/local-media/${sanitizeFilename(slide.backgroundAudio.filename || '')}`
          : null,
      }
    }
    return slide
  }

  const resolved = { ...slide }
  if (slide.blockType === 'imageBlock' && slide.image) {
    const img = typeof slide.image === 'object' ? slide.image : null
    if (img) {
      const sizeFilename = img.sizes?.fullHD?.filename
      resolved.image = {
        url: sizeFilename
          ? `/local-media/${sanitizeFilename(sizeFilename)}`
          : img.url
            ? `/local-media/${sanitizeFilename(img.filename || '')}`
            : null,
        alt: img.alt || null,
      }
    }
  }
  if (slide.blockType === 'videoBlock' && slide.video) {
    const vid = typeof slide.video === 'object' ? slide.video : null
    if (vid) {
      resolved.video = {
        url: vid.url
          ? `/local-media/${sanitizeFilename(vid.filename || '')}`
          : null,
        alt: vid.alt || null,
      }
    }
  }
  if (slide.blockType === 'audioBlock' && slide.audio) {
    const aud = typeof slide.audio === 'object' ? slide.audio : null
    if (aud) {
      resolved.audio = {
        url: aud.url
          ? `/local-media/${sanitizeFilename(aud.filename || '')}`
          : null,
        alt: aud.alt || null,
      }
    }
  }
  return resolved
}

function buildScheduleJson(scheduleItems, availabilityItems, backgroundUrl, deviceName) {
  const schedule = scheduleItems.map(item => ({
    programId: item.program?.id,
    scheduleType: 'autoplay',
    startTime: item.startTime,
    endTime: item.endTime,
    daysOfWeek: item.daysOfWeek || [],
    untilDate: item.untilDate || null,
    program: {
      id: item.program?.id,
      title: item.program?.title,
      loop: item.program?.loop,
      department: item.program?.folder?.department?.name || null,
      slides: (item.program?.slides || []).map(resolveSlideMedia),
    },
  }))

  const availability = availabilityItems.map(item => ({
    programId: item.program?.id,
    scheduleType: 'availability',
    startDate: item.startDate,
    endDate: item.endDate || null,
    program: {
      id: item.program?.id,
      title: item.program?.title,
      loop: item.program?.loop,
      department: item.program?.folder?.department?.name || null,
      slides: (item.program?.slides || []).map(resolveSlideMedia),
    },
  }))

  return {
    lastUpdated: new Date().toISOString(),
    schedule,
    availability,
    defaultBackground: backgroundUrl || null,
    deviceName: deviceName || null,
  }
}

function writeScheduleAtomically(data, schedulePath) {
  try {
    const existing = JSON.parse(fs.readFileSync(schedulePath, 'utf-8'))
    const { lastUpdated: a, ...existingRest } = existing
    const { lastUpdated: b, ...dataRest } = data
    if (JSON.stringify(existingRest) === JSON.stringify(dataRest)) {
      return false
    }
  } catch {}

  const dir = path.dirname(schedulePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = schedulePath + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n')
  fs.renameSync(tmp, schedulePath)
  return true
}

module.exports = {
  sanitizeFilename,
  resolveSlideMedia,
  buildScheduleJson,
  writeScheduleAtomically,
}
