import type { CollectionBeforeValidateHook } from 'payload'

export const programBeforeValidate: CollectionBeforeValidateHook = ({ data }) => {
  if (data?.slides && Array.isArray(data.slides)) {
    data.slides = data.slides.filter((s: any) => {
      if (s.id === 'auto-end') return false
      if (!s.blockType) {
        console.warn('[Programs.beforeValidate] Filtered out slide missing blockType:', s)
        return false
      }
      return true
    })
  }
  return data
}
