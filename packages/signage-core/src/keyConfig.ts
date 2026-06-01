import { KeyConfig, DEFAULT_KEY_CONFIG } from './types'

export function mergeKeyConfig(userConfig?: Partial<KeyConfig>): KeyConfig {
  return { ...DEFAULT_KEY_CONFIG, ...userConfig }
}
