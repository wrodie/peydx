import type { CollectionBeforeChangeHook } from 'payload'

export const mediaNameAutoFill: CollectionBeforeChangeHook = async ({ data, req }) => {
  if (!data.name && req.file?.name) {
    data.name = req.file.name.replace(/\.[^.]+$/, '')
  }
  return data
}
