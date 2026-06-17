import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { generateMediaToken, verifyMediaToken } from '../../../utilities/mediaToken'

const SECRET = 'test-secret-key-123'

describe('mediaToken', () => {
  describe('generateMediaToken', () => {
    it('generates a token string with expiry and signature', () => {
      const token = generateMediaToken('my-video.mp4', SECRET)
      const parts = token.split('.')
      expect(parts).toHaveLength(2)
      expect(Number(parts[0])).toBeGreaterThan(0)
      expect(parts[1]).toHaveLength(64)
    })
  })

  describe('verifyMediaToken', () => {
    it('generated token passes verification within TTL', () => {
      const token = generateMediaToken('my-video.mp4', SECRET)
      expect(verifyMediaToken(token, 'my-video.mp4', SECRET)).toBe(true)
    })

    it('tampered token fails verification', () => {
      const token = generateMediaToken('my-video.mp4', SECRET)
      const tampered = token.replace(/^(\d+)\./, (_: any, exp: any) => `${Number(exp) + 99999}.`)
      expect(verifyMediaToken(tampered, 'my-video.mp4', SECRET)).toBe(false)
    })

    it('token for wrong filename fails verification', () => {
      const token = generateMediaToken('video-a.mp4', SECRET)
      expect(verifyMediaToken(token, 'video-b.mp4', SECRET)).toBe(false)
    })

    it('malformed token returns false', () => {
      expect(verifyMediaToken('not-a-token', 'file.mp4', SECRET)).toBe(false)
      expect(verifyMediaToken('123.abc.extra', 'file.mp4', SECRET)).toBe(false)
    })

    it('wrong secret fails verification', () => {
      const token = generateMediaToken('file.mp4', SECRET)
      expect(verifyMediaToken(token, 'file.mp4', 'wrong-secret')).toBe(false)
    })
  })
})
