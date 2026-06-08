import type { Block } from 'payload'
import { ImageBlock, VideoBlock, YoutubeBlock, AudioBlock } from './SlideBlocks'
import { BlackScreenBlock } from './BlackScreenBlock'

export const SegmentBlock: Block = {
  slug: 'segmentBlock',
  labels: {
    singular: 'Segment',
    plural: 'Segments',
  },
  admin: {
    group: 'Structure',
    disableBlockName: true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Segment name',
      admin: {
        description: 'For identification in the admin UI only.',
      },
    },
    {
      name: 'backgroundAudio',
      type: 'upload',
      relationTo: 'media',
      label: 'Background Audio',
      filterOptions: {
        mimeType: { contains: 'audio' },
      },
      admin: {
        description: 'Audio that plays across all slides in this segment.',
      },
    },
    {
      name: 'loop',
      type: 'checkbox',
      label: 'Loop segment',
      defaultValue: false,
      admin: {
        description: 'When enabled, the segment restarts from slide 1 after the last slide.',
      },
    },
    {
      name: 'advanceMode',
      type: 'select',
      label: 'How to exit this segment',
      defaultValue: 'slides',
      options: [
        { label: 'Follow slides', value: 'slides' },
        { label: 'Timer', value: 'timed' },
        { label: 'Manual', value: 'manual' },
      ],
      admin: {
        description: 'How the player moves to the next item after this segment ends.',
      },
    },
    {
      name: 'duration',
      type: 'number',
      min: 1,
      label: 'Duration (minutes)',
      admin: {
        condition: (_, siblingData) => siblingData?.advanceMode === 'timed',
        description: 'Play this segment for this many minutes, then advance.',
      },
    },
    {
      name: 'slides',
      type: 'blocks',
      required: true,
      blocks: [
        ImageBlock, VideoBlock, YoutubeBlock,
        AudioBlock, BlackScreenBlock,
      ],
      labels: {
        singular: 'Slide',
        plural: 'Slides',
      },
      admin: {
        description: 'Slides within this segment.',
      },
    },
    {
      name: 'bulkMedia',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      admin: {
        description: 'Drop files here to auto-generate slides inside this segment.',
      },
    },
  ],
}
