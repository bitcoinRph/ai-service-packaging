// Constants shared across the package codebase.

export const gatewayPort = 8080
export const webPort = 8081

export const whisperModels = [
  'tiny',
  'base',
  'small',
  'medium',
  'large-v3-turbo',
] as const

export type WhisperModel = (typeof whisperModels)[number]
