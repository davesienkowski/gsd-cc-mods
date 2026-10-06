export type WhisperKind = 'advice' | 'block' | 'ask'

export type Whisper = {
  id: number
  at: number
  event: string
  rule: string
  kind: WhisperKind
  summary: string
  tool?: string
  toolUseId?: string
  isSubagent: boolean
}

export type WhisperStats = {
  events: Record<string, number>
  withOutput: Record<string, number>
  recognized: number
  unrecognized: string[]
}

export type Critical = { usedPct: number; remainingPct: number; at: number }

declare module 'claude-code' {
  interface PluginState {
    'gsd-whisper': {
      whispers: Whisper[]
      stats: WhisperStats
      critical: Critical | null
      byCall: StateFamily<Whisper[]>
    }
  }
}
