import { KeyConfig, DEFAULT_KEY_CONFIG } from './types'

export function mergeKeyConfig(userConfig?: Partial<KeyConfig>): KeyConfig {
  return { ...DEFAULT_KEY_CONFIG, ...userConfig }
}

export function normalizeKeyCode(value: string | string[] | undefined): string[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}
