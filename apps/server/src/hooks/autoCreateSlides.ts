import type { CollectionAfterChangeHook } from 'payload'

export const autoCreateSlides: CollectionAfterChangeHook = async ({
  doc, // The current Program document
  previousDoc, // The document before the save
  req, // The request object (gives access to Payload API)
}) => {
  // 1. Check if bulkMedia has new items
  const newMediaIds = doc.bulkMedia?.filter(
    (id: string) => !previousDoc.bulkMedia?.includes(id)
  )

  if (!newMediaIds || newMediaIds.length === 0) return doc

  // 2. Fetch the media details to see if they are images or videos
  const newBlocks = await Promise.all(
    newMediaIds.map(async (id: string) => {
      const media = await req.payload.findByID({
        collection: 'media',
        id,
      })

      const isVideo = media.mimeType?.includes('video')

      // 3. Return the block with "Smart Defaults"
      return {
        blockType: isVideo ? 'videoBlock' : 'imageBlock',
        // Map the correct field name based on type
        [isVideo ? 'video' : 'image']: id,
        // Smart Defaults
        advanceMode: isVideo ? 'onEnd' : 'timed',
        duration: isVideo ? undefined : 5,
        transition: 'fade',
      }
    })
  )

  // 4. Update the document with the new blocks appended
  await req.payload.update({
    collection: 'programs',
    id: doc.id,
    data: {
      slides: [...(doc.slides || []), ...newBlocks],
      bulkMedia: [], // Clear the bulk field so it's ready for next time
    },
    // Prevent this update from re-triggering this hook (infinite loop)
    context: { preventSync: true }, 
  })

  return doc
}
