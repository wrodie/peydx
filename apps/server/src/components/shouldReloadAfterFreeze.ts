export function shouldReloadAfterFreeze(
  gap: number,
  threshold: number,
  isPlaying: boolean,
  isVisible: boolean,
): boolean {
  return gap > threshold && isVisible && isPlaying
}
