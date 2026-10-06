import type { PilotAction, PilotSnapshot, PilotVerification } from '../types'

// Builds what the palette draws from two gsd-tools answers. Pure, so it is
// tested without a process.

export type InspectJson = {
  generated_from?: { cwd?: string; planning_root?: string }
  milestone?: { version?: string | null; name?: string | null }
  active?: { phase?: { value?: unknown }; status?: { value?: unknown } }
  progress?: unknown
  phases?: Array<{
    dir?: string
    phase_id?: string
    complete?: boolean
    verification?: { status?: string; next_action?: string; route?: string | null }
  }>
}

export type SmartJson = {
  situation?: string
  actions?: Array<{ label?: string; command?: string; recommended?: boolean }>
}

// gsd-tools still answers some commands in the retired colon form
// (`/gsd:progress --next`) while a Claude install registers `gsd-progress`.
// Use whichever spelling the session actually lists; mark it unavailable when
// neither is there, rather than fill a command that does not exist.
export function resolveCommand(raw: string, names: ReadonlySet<string>): { command: string; isAvailable: boolean } {
  const m = raw.trim().match(/^\/(?:gsd[:-])?([a-z0-9-]+)(.*)$/i)
  if (m === null) return { command: raw, isAvailable: false }
  const tail = m[2] ?? ''
  for (const name of [`gsd-${m[1]}`, `gsd:${m[1]}`]) {
    if (names.has(name)) return { command: `/${name}${tail}`, isAvailable: true }
  }
  return { command: raw, isAvailable: false }
}

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' && v.trim() !== '—' ? v.trim() : null)

function progressOf(p: unknown): string | null {
  if (p === null || typeof p !== 'object') return null
  const o = p as Record<string, unknown>
  const done = o.completed_plans ?? o.summaries ?? o.total_summaries
  const total = o.total_plans ?? o.plans
  if (typeof done === 'number' && typeof total === 'number' && total > 0) return `${done}/${total} plans`
  return null
}

export function buildSnapshot(
  inspect: InspectJson,
  smart: SmartJson,
  names: ReadonlySet<string>,
  cwd: string,
  now: number,
): PilotSnapshot {
  const planningRoot = inspect.generated_from?.planning_root ?? `${cwd}/.planning`
  const rootDir = planningRoot.replace(/\/\.planning\/?$/, '')
  const actions: PilotAction[] = (smart.actions ?? [])
    .filter(a => typeof a.command === 'string')
    .map(a => {
      const r = resolveCommand(a.command as string, names)
      return {
        label: a.label ?? r.command,
        command: r.command,
        isRecommended: a.recommended === true,
        isAvailable: r.isAvailable,
      }
    })

  // The phase the person is in: the first one not complete. Never guessed
  // from anything else; null when every phase is complete or none exist.
  const focus = (inspect.phases ?? []).find(p => p.complete !== true && typeof p.phase_id === 'string')
  let verification: PilotVerification | null = null
  if (focus && focus.verification && typeof focus.verification.status === 'string') {
    const route = text(focus.verification.route)
    const resolved = route ? resolveCommand(`/gsd-${route} ${focus.phase_id}`, names) : null
    verification = {
      phaseId: focus.phase_id as string,
      phaseDir: focus.dir ?? '',
      status: focus.verification.status,
      nextAction: focus.verification.next_action ?? '',
      command: resolved && resolved.isAvailable ? resolved.command : null,
    }
  }

  return {
    at: now,
    planningRoot,
    isElsewhere: rootDir !== cwd.replace(/\/$/, ''),
    milestone: text(inspect.milestone?.version) ?? text(inspect.milestone?.name),
    situation: smart.situation ?? 'unknown',
    activePhase: text(inspect.active?.phase?.value),
    activeStatus: text(inspect.active?.status?.value),
    progress: progressOf(inspect.progress),
    actions,
    verification,
  }
}
