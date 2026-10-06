import { atom, memberOf, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren } from 'claude-code'

import type { Critical, Whisper, WhisperKind, WhisperStats } from '../types'
import { classify } from './classify'

// gsd-whisper: shows the person what gsd-core's hooks tell the agent.
//
// A hooks module sits above the settings hooks in every classic event's chain,
// so `await next(e)` returns what gsd-core's command hooks answered. This mod
// only reads that answer and always returns it unchanged: it never rewrites
// what the model receives and never decides a tool call.
//
// Where it shows up:
// - a badge under the tool row a gsd-core hook spoke about,
// - a toast for messages tied to no tool call (Stop, session start),
// - a band above the prompt at gsd-core's context CRITICAL,
// - a pane, /gsd-whisper, with the session's history.

const whispers = atom({ plugin: 'gsd-whisper', key: 'whispers' } as const, [] as Whisper[])
const stats = atom({ plugin: 'gsd-whisper', key: 'stats' } as const, {
  events: {},
  withOutput: {},
  recognized: 0,
  unrecognized: [],
} as WhisperStats)
const critical = atom({ plugin: 'gsd-whisper', key: 'critical' } as const, null as Critical | null)
const byCall = atom({ plugin: 'gsd-whisper', key: 'byCall' } as const, [] as Whisper[])

const PANE = 'gsd-whisper'
const KEEP = 200
const REPEAT_MS = 60_000

// Texts toasted recently, so a message tied to no tool call is toasted once a
// minute. A module variable: a reload resets it, which only re-shows a toast.
const lastToasted = new Map<string, number>()

// ---- pane placement: the gsd-status-mod setup (a docked pane, `openOnStart`),
// off by default here since the history is empty until a hook speaks. The pane
// opens unasked only where Claude Code's fullscreen layout docks it as a
// sidebar (`/tui fullscreen`), and says why when it waits: an Orca split is
// often under the 144 columns an unasked pane needs (110 once opened by hand).

const PANE_SIZE = { columns: 64, rows: 16 }
const LAYOUT_KEY = 'fullscreen'
const HINTED_KEY = 'hinted-main-screen'

let openOnStart = false
let fullscreen: boolean | undefined // as a render or command last reported it; fixed per session
let autoTried = false
let closedByHand = false
const openRows = new Set<string>() // history rows the person opened with their ▸

function rowId(w: Whisper): string {
  return `${w.at}|${w.event}|${w.rule}|${w.toolUseId ?? ''}`
}

export const MAIN_SCREEN_HINT =
  'Claude Code is on its main-screen layout, so the pane sits above the prompt. Run /tui fullscreen to dock it on the right (Orca included).'

export function waitingHint(reason: string): string {
  return `GSD whispers pane is waiting: ${reason.replace(/\.?\s*$/, '.')} Run /gsd-whisper to open it now.`
}

function noteLayout(v: { isFullscreen?: boolean } | undefined): void {
  if (typeof v?.isFullscreen === 'boolean') fullscreen = v.isFullscreen
}

async function keepLayout($: EngineInterface): Promise<void> {
  if (fullscreen !== undefined && (await $.store.get(LAYOUT_KEY)) !== fullscreen) await $.store.set(LAYOUT_KEY, fullscreen)
}

// The unasked open, tried once per session as soon as the layout is known, and
// only in a GSD project (a .planning/STATE.md where the session started).
async function autoOpen($: EngineInterface): Promise<void> {
  if (autoTried || closedByHand || !openOnStart) return
  if (!(await $.fs.exists(`${await $.session.cwd()}/.planning/STATE.md`))) return
  const stored = await $.store.get(LAYOUT_KEY)
  const layout = fullscreen ?? (typeof stored === 'boolean' ? stored : undefined)
  if (layout === undefined) return
  // A remembered layout is a guess (the person may have run /tui since): it can
  // open the pane early, but only this session's own report settles a "no".
  if (layout || fullscreen !== undefined) autoTried = true
  if (!layout) {
    if ((await $.store.get(HINTED_KEY)) !== true) {
      await $.store.set(HINTED_KEY, true)
      $.ui.toast(`gsd-whisper: ${MAIN_SCREEN_HINT}`)
    }
    return
  }
  const opened = await $.ui.open({ id: PANE, title: 'GSD whispers', ...PANE_SIZE })
  if (!opened.isPlaced) $.ui.toast(waitingHint(opened.reason))
}

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
  toolUseId: string | undefined,
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
      toolUseId,
      isSubagent,
    }
    await update($, stats, s => ({ ...s, recognized: s.recognized + 1 }))
    await update($, whispers, list => [...list, whisper].slice(-KEEP))
    $.ui.log(`${whisper.kind} ${whisper.rule}: ${whisper.summary}`, { to: 'debug' })

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

    if (toolUseId !== undefined) {
      // The tool row draws it as a badge.
      await update($, memberOf(byCall, { requestId: toolUseId }), list => [...list, whisper])
      continue
    }

    if (hit.rule.startsWith('context-')) continue
    const key = `${hit.rule}|${hit.summary}`
    const last = lastToasted.get(key)
    if (last !== undefined && now - last < REPEAT_MS) continue
    lastToasted.set(key, now)
    $.ui.toast(`GSD ${labelOf(whisper.kind).toLowerCase()}: ${hit.summary}`)
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
    const input = e as { tool_name?: unknown; tool_use_id?: unknown; agent_id?: unknown }
    const tool = typeof input.tool_name === 'string' ? input.tool_name : undefined
    const toolUseId = typeof input.tool_use_id === 'string' ? input.tool_use_id : undefined
    const isSubagent = typeof input.agent_id === 'string' || event === 'classic.SubagentStop'
    await observe($, event, result, tool, toolUseId, isSubagent)
  } catch {
    // observation never changes the outcome
  }
  return result
}

function labelOf(kind: WhisperKind): string {
  return kind === 'block' ? 'BLOCKED' : kind === 'ask' ? 'ASKED' : 'ADVISED'
}

function colorOf(kind: WhisperKind): string {
  return kind === 'block' ? 'error' : kind === 'ask' ? 'warning' : 'suggestion'
}

// The card look: a rounded border in the message's colour on the same subtle
// background Claude Code draws the person's own prompt rows on, so a card stands
// apart from tool output in any theme (`userMessageBackground` is a key of the
// person's theme, not a fixed colour).
const CARD_BG = 'userMessageBackground'

// The surface's Box and Text, as `$.ui.resolve(e)` hands them to a render hook.
// Typed loosely here: every surface's table has both, with the props used below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Els = { Box: any; Text: any }

// One message as two lines: label and rule, then the summary cut to the width.
// Two lines because one row squeezed the rule name into a wrap.
function cardLines({ Box, Text }: Els, w: Whisper, i: number, extra: string, withGsd: boolean) {
  return (
    <Box key={`gsd-line-${i}`} flexDirection="column">
      <Box flexShrink={0}>
        {withGsd && (
          <Text color="claude" bold>
            GSD{' '}
          </Text>
        )}
        <Text color={colorOf(w.kind)} inverse>
          {` ${labelOf(w.kind)} `}
        </Text>
        <Text bold>{` ${w.rule}`}</Text>
        <Text color="subtle">{extra}</Text>
      </Box>
      <Box paddingLeft={2}>
        <Text wrap="truncate-end">{w.summary}</Text>
      </Box>
    </Box>
  )
}

function severity(kind: WhisperKind): number {
  return kind === 'block' ? 3 : kind === 'ask' ? 2 : 1
}

function ago(now: number, at: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.round(s / 60)}m`
  return `${Math.round(s / 3600)}h`
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

export const register: Register = (on, options) => {
  openOnStart = options.openOnStart === true
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'gsd-whisper',
      description: 'Open the pane of what gsd-core hooks told the agent this session',
      argumentHint: '[clear]',
    })
    // Spike aid (v0.1): lets the agent read the same report, so a live session
    // can check what the mod saw. Read-only.
    await $.tool.register({
      name: 'report',
      description:
        'Read-only. Returns what gsd-core hooks told the agent this session, as seen by the gsd-whisper mod, with per-event counts.',
    })
    if (e.isInteractive) void autoOpen($).catch(() => undefined)
    return next(e)
  })

  // The first turn settles the layout a first-ever session did not know.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined) {
      void autoOpen($).catch(() => undefined)
      void keepLayout($).catch(() => undefined)
    }
    return result
  })

  // Closed with its close mark (or ctrl+x x): not reopened unasked this session.
  on('ui.close', { id: PANE }, async ($, e, next) => {
    const result = await next(e)
    if (e.origin.kind === 'person') closedByHand = true
    return result
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'mcp__gsd-whisper__report' }, async $ => {
    return { result: report(await read($, whispers), await read($, stats)) }
  })

  on('command.run', { command: 'gsd-whisper' }, async ($, e) => {
    if (e.args.trim() === 'clear') {
      await update($, whispers, () => [])
      return { text: 'Cleared the GSD whispers history.' }
    }
    noteLayout(e.presentation)
    closedByHand = false
    const opened = await $.ui.open({ id: PANE, title: 'GSD whispers', ...PANE_SIZE })
    await keepLayout($).catch(() => undefined)
    if (opened.isPlaced) {
      return { text: `Opened the GSD whispers pane.${e.presentation?.isFullscreen === false ? ` ${MAIN_SCREEN_HINT}` : ''}` }
    }
    return { text: report(await read($, whispers), await read($, stats)) }
  })

  // Tool calls: gsd-core's PreToolUse guards answer here (deny or advice).
  on('classic.PreToolUse', async ($, e, next) => {
    const result = await next(e)
    try {
      await observe($, 'classic.PreToolUse', result, String(e.tool), e.tool_use_id, false)
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
  // Not classic.FileChanged: Claude Code 2.1.291's types list no additionalContext
  // for that event (ClassicResultFields), so there is nothing to observe there.
  on('classic.UserPromptSubmit', ($, e, next) => watch($, 'classic.UserPromptSubmit', e, next)).catch(($, e, next) => next(e))

  // A badge under a standalone tool row that a gsd-core hook spoke about.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const list = await read($, memberOf(byCall, e))
    if (list.length === 0) return next(e)
    const own = await next(e)
    const { Box, Text } = $.ui.resolve(e)
    const shown = [...list].sort((a, b) => severity(b.kind) - severity(a.kind)).slice(0, 2)
    const top = shown[0]!
    return (
      <Box flexDirection="column">
        {own}
        <Box
          key="gsd-badge-0"
          flexDirection="column"
          marginLeft={2}
          paddingX={1}
          borderStyle="round"
          borderColor={colorOf(top.kind)}
          backgroundColor={CARD_BG}
        >
          {shown.map((w, i) => cardLines({ Box, Text }, w, i, '', true))}
          {list.length > 2 && <Text color="subtle">{`+${list.length - 2} more in /gsd-whisper`}</Text>}
        </Box>
      </Box>
    )
  })

  // Reads and searches fold into one group line; badge the group instead.
  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    if (e.props.isExpanded) return next(e)
    const found: Whisper[] = []
    for (const call of e.props.calls) {
      if (call.tool_use_id === undefined) continue
      const list = await read($, memberOf(byCall, { requestId: call.tool_use_id }))
      found.push(...list)
    }
    if (found.length === 0) return next(e)
    const own = await next(e)
    const { Box, Text } = $.ui.resolve(e)
    // Lead with the most severe: a block matters more than advice beside it.
    const top = [...found].sort((a, b) => severity(b.kind) - severity(a.kind))[0]!
    return (
      <Box flexDirection="column">
        {own}
        <Box
          key="gsd-badge-group"
          flexDirection="column"
          marginLeft={2}
          paddingX={1}
          borderStyle="round"
          borderColor={colorOf(top.kind)}
          backgroundColor={CARD_BG}
        >
          {cardLines(
            { Box, Text },
            top,
            0,
            found.length > 1 ? `  +${found.length - 1} more in /gsd-whisper` : '',
            true,
          )}
        </Box>
      </Box>
    )
  })

  // The session's history, drawn as gsd-status-mod draws its pane: a centred
  // header, then one round-bordered panel per topic, title left, note right.
  // A row's ▸ opens its whole message; the rest stay one line each.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    noteLayout(e.viewport)
    const W = Math.max(40, e.props.bodyColumns)
    const list = await read($, whispers)
    const now = await $.clock.now()
    const room = Math.max(3, Math.floor((e.props.scroll.bodyRows - 9) / 2))
    const counts = { block: 0, ask: 0, advice: 0 }
    for (const w of list) counts[w.kind] += 1
    const worst: WhisperKind | null = counts.block > 0 ? 'block' : counts.ask > 0 ? 'ask' : counts.advice > 0 ? 'advice' : null
    const panel = (key: string, color: string, title: string, right: RenderChildren, children: RenderChildren[]) => (
      <Box key={key} flexDirection="column" borderStyle="round" borderColor={color} paddingX={1} width={W}>
        <Box justifyContent="space-between">
          <Text bold wrap="truncate">
            {title}
          </Text>
          {right}
        </Box>
        {children}
      </Box>
    )
    const shown = list.slice(-room).reverse()
    return (
      <Box flexDirection="column" width={W}>
        <Box justifyContent="center">
          <Text bold>
            <Text color="claude">GSD</Text> whispers
          </Text>
        </Box>
        {panel(
          'counts',
          worst ? colorOf(worst) : 'subtle',
          'this session',
          <Text color="subtle">{`${list.length} in all`}</Text>,
          [
            <Box key="tally">
              <Text color="error">{`${counts.block} blocked  `}</Text>
              <Text color="warning">{`${counts.ask} asked  `}</Text>
              <Text color="suggestion">{`${counts.advice} advised`}</Text>
            </Box>,
            <Text key="what" color="subtle" wrap="truncate-end">
              What gsd-core's hooks told the agent.
            </Text>,
          ],
        )}
        {panel(
          'history',
          'claude',
          'newest first',
          list.length > shown.length ? <Text color="subtle">{`${shown.length} of ${list.length}`}</Text> : null,
          [
            list.length === 0 ? (
              <Text key="none" color="subtle">
                Nothing yet this session.
              </Text>
            ) : null,
            ...shown.map((w, i) => {
              const id = rowId(w)
              const isOpen = openRows.has(id)
              return (
                <Box key={`row-${i}`} flexDirection="column">
                  <Box>
                    <Button
                      key={`open-${i}`}
                      label={isOpen ? '▾' : '▸'}
                      plain
                      onPress={() => {
                        if (!openRows.delete(id)) openRows.add(id)
                        $.ui.invalidate('ui.render')
                      }}
                    />
                    <Text color={colorOf(w.kind)} inverse>{` ${labelOf(w.kind)} `}</Text>
                    <Text bold wrap="truncate">{` ${w.rule}`}</Text>
                    <Text color="subtle" wrap="truncate">
                      {`${w.tool ? `  ${w.tool}` : ''}${w.isSubagent ? ' (subagent)' : ''}  ${ago(now, w.at)} ago`}
                    </Text>
                  </Box>
                  <Box paddingLeft={2}>
                    <Text wrap={isOpen ? 'wrap' : 'truncate-end'}>{w.summary}</Text>
                  </Box>
                </Box>
              )
            }),
          ],
        )}
        <Box key="footer">
          <Button key="clear" label="clear" plain hotkey="c" onPress={() => update($, whispers, () => [])} />
          <Text color="subtle" wrap="truncate">
            {'  or /gsd-whisper clear; keys after ctrl+x, tab'}
          </Text>
        </Box>
      </Box>
    )
  })

  // At CRITICAL the agent is told to stop; offer the person the matching move.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    noteLayout(e.viewport)
    const c = await read($, critical)
    if (c === null) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    return (
      <Box>
        <Text color="warning">GSD: context critical ({c.remainingPct}% left). </Text>
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
