import type Konva from 'konva'

export async function captureRender(stage: Konva.Stage): Promise<Blob> {
  await document.fonts.ready

  const canvas = stage.toCanvas({
    pixelRatio: 1,
  })

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      blob ? resolve(blob) : reject(new Error('canvas.toBlob failed'))
    }, 'image/png')
  })
}

export async function uploadRender(
  blob: Blob,
  title: string,
  existingMediaId?: number | null,
): Promise<number> {
  const formData = new FormData()
  formData.append('file', blob, `${title || 'slide'}.png`)
  formData.append('name', title || 'Untitled Slide')

  if (existingMediaId) {
    const res = await fetch(`/api/media/${existingMediaId}`, {
      method: 'PATCH',
      body: formData,
    })
    if (!res.ok) throw new Error(`Media update failed: ${res.status}`)
    const doc = await res.json()
    return doc.id
  } else {
    const res = await fetch('/api/media', {
      method: 'POST',
      body: formData,
    })
    if (!res.ok) throw new Error(`Media upload failed: ${res.status}`)
    const doc = await res.json()
    return doc.id
  }
}
