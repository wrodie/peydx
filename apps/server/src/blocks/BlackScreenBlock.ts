import type { Block } from 'payload'
import { getAdvanceSettings, getSlideMoveControl } from './SlideBlocks'

export const BlackScreenBlock: Block = {
  slug: 'blackScreenBlock',
  labels: {
    singular: 'Black Screen',
    plural: 'Black Screens',
  },
  admin: {
    group: 'Utility',
    disableBlockName: true,
  },
  fields: [
    ...getAdvanceSettings(false),
    getSlideMoveControl(),
  ],
}
