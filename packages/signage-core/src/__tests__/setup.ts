import '@testing-library/jest-dom/vitest'

if (typeof window !== 'undefined') {
  const noop = () => {}
  const proto = window.HTMLMediaElement.prototype
  proto.play = noop
  proto.pause = noop
  proto.load = noop

  class MockImage {
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    naturalWidth = 1920
    naturalHeight = 1080
    set src(_url: string) {
      if (this.onload) this.onload()
    }
    decode(): any {
      const m = {
        then: (fn: () => void) => { fn(); return m },
        catch: () => m,
      }
      return m
    }
  }
  ;(window as any).Image = MockImage
}
