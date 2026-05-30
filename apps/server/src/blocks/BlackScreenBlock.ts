import type { Block } from 'payload'
import { getAdvanceSettings } from './SlideBlocks'

export const BlackScreenBlock: Block = {
  slug: 'blackScreenBlock',
  labels: {
    singular: 'Black Screen',
    plural: 'Black Screens',
  },
  admin: {
    group: 'Utility',
  },
  fields: [
    ...getAdvanceSettings(false),
  ],
}
