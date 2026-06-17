import { describe, it, expect } from 'vitest'
import { mediaNameAutoFill } from '../../../hooks/mediaNameAutoFill'

describe('mediaNameAutoFill', () => {
  it('sets name from req.file.name with extension stripped', async () => {
    const data = {}
    const result = await mediaNameAutoFill({
      data,
      req: { file: { name: 'sunset.jpg' } },
    } as any)
    expect(result.name).toBe('sunset')
  })

  it('preserves custom name when already provided', async () => {
    const data = { name: 'My Custom Name' }
    const result = await mediaNameAutoFill({
      data,
      req: { file: { name: 'ignored.jpg' } },
    } as any)
    expect(result.name).toBe('My Custom Name')
  })

  it('does not crash when req.file is undefined', async () => {
    const data = {}
    const result = await mediaNameAutoFill({
      data,
      req: {},
    } as any)
    expect(result).toEqual({})
  })

  it('strips multi-dot extensions correctly', async () => {
    const data = {}
    const result = await mediaNameAutoFill({
      data,
      req: { file: { name: 'archive.tar.gz' } },
    } as any)
    expect(result.name).toBe('archive.tar')
  })
})
