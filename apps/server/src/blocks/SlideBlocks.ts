import type { Block, Field } from 'payload'

/**
 * Shared Advance Settings
 * We use a function to return the fields so we can customize the 
 * options (like excluding 'onEnd' for images).
 */
export const getAdvanceSettings = (isVideoButton: boolean): Field[] => {
  const options = [
    { label: 'Timed (Automatic)', value: 'timed' },
    { label: 'Manual (Wait for Click)', value: 'manual' },
  ]

  if (isVideoButton) {
    options.push({ label: 'On End (Play to Finish)', value: 'onEnd' })
  }

  return [
    {
      name: 'transition',
      type: 'select',
      label: 'Transition into slide',
      defaultValue: 'fade',
      options: [
        { label: 'Fade In', value: 'fade' },
        { label: 'Instant Cut', value: 'cut' },
        { label: 'Slide Left', value: 'slide' },
      ],
    },
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
    disableBlockName: true,
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
    disableBlockName: true,
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
    {
      name: 'loop',
      type: 'checkbox',
      label: 'Loop Media',
      defaultValue: false,
      admin: {
        description: 'Repeats the video until the slide transitions.',
      },
    },
  ],
}

export const YoutubeBlock: Block = {
  slug: 'youtubeBlock',
  labels: {
    singular: 'YouTube Video',
    plural: 'YouTube Videos',
  },
  admin: {
    group: 'Content',
    disableBlockName: true,
  },
  fields: [
    {
      name: 'youtubeId',
      type: 'text',
      required: true,
      label: 'YouTube URL or ID',
      admin: {
        description: 'Paste a YouTube link (e.g. youtube.com/watch?v=...) or just the video ID.',
      },
    },
    ...getAdvanceSettings(true),
    {
      name: 'loop',
      type: 'checkbox',
      label: 'Loop Media',
      defaultValue: false,
      admin: {
        description: 'Repeats the video until the slide transitions.',
      },
    },
  ],
}

export const AudioBlock: Block = {
  slug: 'audioBlock',
  labels: {
    singular: 'Audio Slide',
    plural: 'Audio Slides',
  },
  admin: {
    group: 'Content',
    disableBlockName: true,
  },
  fields: [
    {
      name: 'audio',
      type: 'upload',
      relationTo: 'media',
      required: true,
      filterOptions: {
        mimeType: { contains: 'audio' },
      },
    },
    ...getAdvanceSettings(true),
    {
      name: 'loop',
      type: 'checkbox',
      label: 'Loop Media',
      defaultValue: false,
      admin: {
        description: 'Repeats the audio until the slide transitions.',
      },
    },
  ],
}