import type { Block, Field } from 'payload'

/**
 * Shared Advance Settings
 * We use a function to return the fields so we can customize the 
 * options (like excluding 'onEnd' for images).
 */
const getAdvanceSettings = (isVideoButton: boolean): Field[] => {
  const options = [
    { label: 'Timed (Automatic)', value: 'timed' },
    { label: 'Manual (Wait for Click)', value: 'manual' },
  ]

  if (isVideoButton) {
    options.push({ label: 'On End (Play to Finish)', value: 'onEnd' })
  }

  return [
    {
      name: 'advanceMode',
      type: 'select',
      defaultValue: isVideoButton ? 'onEnd' : 'timed',
      required: true,
      options: options,
      admin: {
        description: 'How should the player move to the next slide?',
      },
    },
    {
      name: 'duration',
      type: 'number',
      defaultValue: 5,
      min: 1,
      admin: {
        condition: (_, siblingData) => siblingData?.advanceMode === 'timed',
        placeholder: 'Enter seconds...',
      },
      label: 'Duration (seconds)',
    },
    {
      name: 'transition',
      type: 'select',
      defaultValue: 'fade',
      options: [
        { label: 'Fade Out/In', value: 'fade' },
        { label: 'Instant Cut', value: 'cut' },
        { label: 'Slide Left', value: 'slide' },
      ],
    }
  ]
}

export const ImageBlock: Block = {
  slug: 'imageBlock',
  labels: {
    singular: 'Image Slide',
    plural: 'Image Slides',
  },
  admin: {
    group: 'Content',
  },
  fields: [
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      required: true,
      // Prevents videos appearing in the image selection list
      filterOptions: {
        mimeType: { contains: 'image' },
      },
    },
    ...getAdvanceSettings(false),
  ],
}

export const VideoBlock: Block = {
  slug: 'videoBlock',
  labels: {
    singular: 'Video Slide',
    plural: 'Video Slides',
  },
  admin: {
    group: 'Content',
  },
  fields: [
    {
      name: 'video',
      type: 'upload',
      relationTo: 'media',
      required: true,
      // Prevents images appearing in the video selection list
      filterOptions: {
        mimeType: { contains: 'video' },
      },
    },
    ...getAdvanceSettings(true),
  ],
}