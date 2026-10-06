import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Critical, Whisper, WhisperKind, WhisperStats } from '../types'
import { classify } from './classify'

// gsd-whisper: shows the person what gsd-core's hooks tell the agent.
//
// A hooks module sits above the settings hooks in every classic event's chain,
// so `await next(e)` returns what gsd-core's command hooks answered. This mod
// only reads that answer and always returns it unchanged: it never rewrites
// what the model receives and never decides a tool call.

const whispers = atom({ plugin: 'gsd-whisper', key: 'whispers' } as const, [] as Whisper[])
const stats = atom({ plugin: 'gsd-whisper', key: 'stats' } as const, {
  events: {},
  withOutput: {},
  recognized: 0,
  unrecognized: [],
} as WhisperStats)
const critical = atom({ plugin: 'gsd-whisper', key: 'critical' } as const, null as Critical | null)

const KEEP = 200
const REPEAT_MS = 60_000

// Texts seen recently, so an advisory that fires on every edit is said once a
// minute. A module variable: a reload resets it, which only re-shows a line.
const lastSaid = new Map<string, number>()

type Seen = { kind: WhisperKind; text: string }

function textsOf(result: unknown): Seen[] {
  const out: Seen[] = []
  if (result === null || typeof result !== 'object') return out
  const r = result as { deny?: unknown; ask?: unknown; block?: unknown; additionalContext?: unknown }
  if (typeof r.deny === 'string') out.push({ kind: 'block', text: r.deny })
  if (typeof r.block === 'string') out.push({ kind: 'block', text: r.block })
  if (typeof r.ask === 'string') out.push({ kind: 'ask', text: r.ask })
  if (Array.isArray(r.additionalContext)) {
    for (const t of r.additionalContext) if (typeof t === 'string') out.push({ kind: 'advice', text: t })
  }
  return out
}

async function observe(
  $: EngineInterface,
  event: string,
  result: unknown,
  tool: string | undefined,
  isSubagent: boolean,
): Promise<void> {
  const seen = textsOf(result)
  const now = await $.clock.now()
  await update($, stats, s => ({
    ...s,
    events: { ...s.events, [event]: (s.events[event] ?? 0) + 1 },
    withOutput: seen.length > 0 ? { ...s.withOutput, [event]: (s.withOutput[event] ?? 0) + 1 } : s.withOutput,
  }))

  for (const one of seen) {
    const hit = classify(one.text)
    if (hit === null) {
      const sample = `${event} ${one.kind}: ${one.text.replace(/\s+/g, ' ').slice(0, 90)}`
      await update($, stats, s => ({ ...s, unrecognized: [...s.unrecognized, sample].slice(-10) }))
      continue
    }

    const whisper: Whisper = {
      id: now,
      at: now,
      event,
      rule: hit.rule,
      kind: one.kind,
      summary: hit.summary,
      tool,
      isSubagent,
    }
    await update($, stats, s => ({ ...s, recognized: s.recognized + 1 }))
    await update($, whispers, list => [...list, whisper].slice(-KEEP))

    if (hit.rule === 'context-critical' && !isSubagent) {
      await update($, critical, () => ({
        usedPct: hit.usedPct ?? 0,
        remainingPct: hit.remainingPct ?? 0,
        at: now,
      }))
      $.ui.toast(`GSD: context critical, ${hit.remainingPct}% left. The agent was told to stop and save state.`)
    } else if (hit.rule === 'context-warning' && !isSubagent) {
      $.ui.toast(`GSD: context at ${hit.remainingPct}% left. The agent was told to wrap up.`)
    }

    const key = `${hit.rule}|${hit.summary}`
    const last = lastSaid.get(key)
    if (last !== undefined && now - last < REPEAT_MS) continue
    lastSaid.set(key, now)

    const who = isSubagent ? ' (subagent)' : ''
    const line =
      one.kind === 'block'
        ? `GSD blocked${tool ? ` ${tool}` : ''}${who}: ${hit.summary}`
        : one.kind === 'ask'
          ? `GSD asked you about${tool ? ` ${tool}` : ''}${who}: ${hit.summary}`
          : `GSD told the agent${who}: ${hit.summary}`
    $.ui.log(line)
  }
}

async function watch<R>(
  $: EngineInterface,
  event: string,
  e: unknown,
  next: (e: never) => Promise<R>,
): Promise<R> {
  const result = await next(e as never)
  try {
    const input = e as { tool_name?: unknown; agent_id?: unknown }
    const tool = typeof input.tool_name === 'string' ? input.tool_name : undefined
    const isSubagent = typeof input.agent_id === 'string' || event === 'classic.SubagentStop'
    await observe($, event, result, tool, isSubagent)
  } catch {
    // observation never changes the outcome
  }
  return result
}

function report(list: Whisper[], s: WhisperStats): string {
  const lines: string[] = ['gsd-whisper', '']
  if (list.length === 0) {
    lines.push('No message from gsd-core hooks seen yet this session.')
  } else {
    lines.push(`Last ${Math.min(list.length, 15)} of ${list.length} messages from gsd-core hooks:`)
    for (const w of list.slice(-15)) {
      const where = w.tool ? ` ${w.tool}` : ''
      lines.push(`- [${w.kind}] ${w.rule}${where}${w.isSubagent ? ' (subagent)' : ''}: ${w.summary}`)
    }
  }
  lines.push('', 'Classic events seen (with hook output / total):')
  const names = Object.keys(s.events).sort()
  if (names.length === 0) lines.push('- none yet')
  for (const n of names) lines.push(`- ${n}: ${s.withOutput[n] ?? 0} / ${s.events[n]}`)
  lines.push(`Recognized as gsd-core: ${s.recognized}`)
  if (s.unrecognized.length > 0) {
    lines.push('', 'Hook output not from gsd-core (last 10, truncated):')
    for (const u of s.unrecognized) lines.push(`- ${u}`)
  }
  return lines.join('\n')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'gsd-whisper',
      description: 'Show what gsd-core hooks told the agent this session',
    })
    // Spike aid (v0.1): lets the agent read the same report, so a live session
    // can check what the mod saw. Read-only.
    await $.tool.register({
      name: 'report',
      description:
        'Read-only. Returns what gsd-core hooks told the agent this session, as seen by the gsd-whisper mod, with per-event counts.',
    })
    return next(e)
  })

  on('tool.call', { tool: 'mcp__gsd-whisper__report' }, async $ => {
    return { result: report(await read($, whispers), await read($, stats)) }
  })

  on('command.run', { command: 'gsd-whisper' }, async $ => {
    return { text: report(await read($, whispers), await read($, stats)) }
  })

  // Tool calls: gsd-core's PreToolUse guards answer here (deny or advice).
  on('classic.PreToolUse', async ($, e, next) => {
    const result = await next(e)
    try {
      await observe($, 'classic.PreToolUse', result, String(e.tool), false)
    } catch {
      // observation never changes the outcome
    }
    return result
  }).catch(($, e, next) => next(e))

  // Every other classic event that carries advice or a block. Each name is a
  // literal: the engine reads the event names from the source.
  on('classic.PostToolUse', ($, e, next) => watch($, 'classic.PostToolUse', e, next)).catch(($, e, next) => next(e))
  on('classic.PostToolUseFailure', ($, e, next) => watch($, 'classic.PostToolUseFailure', e, next)).catch(($, e, next) => next(e))
  on('classic.Stop', ($, e, next) => watch($, 'classic.Stop', e, next)).catch(($, e, next) => next(e))
  on('classic.SubagentStop', ($, e, next) => watch($, 'classic.SubagentStop', e, next)).catch(($, e, next) => next(e))
  on('classic.SessionStart', ($, e, next) => watch($, 'classic.SessionStart', e, next)).catch(($, e, next) => next(e))
  on('classic.FileChanged', ($, e, next) => watch($, 'classic.FileChanged', e, next)).catch(($, e, next) => next(e))
  on('classic.UserPromptSubmit', ($, e, next) => watch($, 'classic.UserPromptSubmit', e, next)).catch(($, e, next) => next(e))

  // At CRITICAL the agent is told to stop; offer the person the matching move.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const c = await read($, critical)
    if (c === null) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    return (
      <Box>
        <Text color="yellow">GSD: context critical ({c.remainingPct}% left). </Text>
        <Button
          key="pause"
          label="Pause work"
          hotkey="p"
          variant="primary"
          onPress={() => $.prompt.fill({ text: '/gsd-pause-work', mode: 'replace' })}
        />
        <Text> </Text>
        <Button key="dismiss" label="Dismiss" onPress={() => update($, critical, () => null)} />
      </Box>
    )
  })
}
