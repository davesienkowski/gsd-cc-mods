export type PilotAction = {
  label: string
  command: string
  isRecommended: boolean
  isAvailable: boolean
}

export type PilotVerification = {
  phaseId: string
  phaseDir: string
  status: string
  nextAction: string
  command: string | null
}

export type PilotSnapshot = {
  at: number
  planningRoot: string
  isElsewhere: boolean
  milestone: string | null
  situation: string
  activePhase: string | null
  activeStatus: string | null
  progress: string | null
  actions: PilotAction[]
  verification: PilotVerification | null
}

export type PilotStatus = { kind: 'ok' | 'none' | 'error'; text: string }

declare module 'claude-code' {
  interface PluginState {
    'gsd-pilot': {
      snapshot: PilotSnapshot | null
      status: PilotStatus
    }
  }
}
