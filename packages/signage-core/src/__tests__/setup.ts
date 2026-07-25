import '@testing-library/jest-dom/vitest'

if (typeof window !== 'undefined') {
  const noop = () => {}
  const proto = window.HTMLMediaElement.prototype
  proto.play = noop
  proto.pause = noop
  proto.load = noop
}
