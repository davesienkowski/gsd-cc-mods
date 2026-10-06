import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { PilotAction, PilotSnapshot, PilotStatus } from '../types'
import { buildSnapshot } from './snapshot'
import type { InspectJson, SmartJson } from './snapshot'

// gsd-pilot: one keystroke to the right GSD move.
//
// It shows what gsd-core already computed (the commands that fit now, the
// active phase's verification state) and offers each as a button that FILLS the
// prompt; the person presses Enter. It computes no GSD verdict of its own, runs
// no GSD command itself, and writes nothing.

const snapshot = atom({ plugin: 'gsd-pilot', key: 'snapshot' } as const, null as PilotSnapshot | null)
const status = atom({ plugin: 'gsd-pilot', key: 'status' } as const, { kind: 'none', text: 'Not read yet.' } as PilotStatus)

// ---- gsd-tools adapter (kept in this file: the loader follows `$` only into
// functions declared in the same file as the hooks, never across an import).

// The one door to gsd-tools. Rules (from the design review, ideas/lens-1/3):
// - Run only the gsd-core the person installed under their Claude config dir,
//   never a gsd-tools.cjs found inside the working tree: mods are not
//   sandboxed, so running a cloned repo's copy would run its code unasked.
// - Prove the install is gsd-core (`runtime-identity`) before first use.
// - Read stdout only: gsd-tools prints config warnings on stderr.
// - Follow `@file:` (results over ~50 KB come back as a temp-file path).
// - Never from a render hook; callers cache per turn.

type GsdResult<T> = { ok: true; value: T } | { ok: false; reason: string }

const TIMEOUT_MS = 8_000

let identity: { path: string; ok: boolean } | null = null

async function toolsPath($: EngineInterface): Promise<string | null> {
  const configDir = (await $.env.get('CLAUDE_CONFIG_DIR')) ?? `${(await $.env.get('HOME')) ?? ''}/.claude`
  const path = `${configDir}/gsd-core/bin/gsd-tools.cjs`
  return (await $.fs.exists(path)) ? path : null
}

async function proven($: EngineInterface): Promise<GsdResult<string>> {
  const path = await toolsPath($)
  if (path === null) return { ok: false, reason: 'gsd-core is not installed for Claude Code (no gsd-core/bin/gsd-tools.cjs under the Claude config dir).' }
  if (identity !== null && identity.path === path) {
    return identity.ok ? { ok: true, value: path } : { ok: false, reason: 'the installed gsd-tools did not prove it is @opengsd/gsd-core.' }
  }
  const ran = await $.process.run(['node', path, 'runtime-identity', '--raw'], { timeoutMs: TIMEOUT_MS })
  const ok = ran.exitCode === 0 && ran.stdout.trim().startsWith('{"packageName":"@opengsd/gsd-core"')
  identity = { path, ok }
  return ok ? { ok: true, value: path } : { ok: false, reason: 'the installed gsd-tools did not prove it is @opengsd/gsd-core.' }
}

async function gsdJson<T>($: EngineInterface, args: string[]): Promise<GsdResult<T>> {
  const tools = await proven($)
  if (!tools.ok) return tools
  const cwd = await $.session.cwd()
  const ran = await $.process.run(['node', tools.value, ...args, '--json-errors'], { cwd, timeoutMs: TIMEOUT_MS })
  if (ran.exitCode !== 0) {
    const first = ran.stderr.split('\n').find(l => l.trim() !== '') ?? `exit ${ran.exitCode}`
    return { ok: false, reason: `gsd-tools ${args[0]}: ${first.slice(0, 200)}` }
  }
  let text = ran.stdout.trim()
  if (text.startsWith('@file:')) {
    try {
      text = (await $.fs.read(text.slice('@file:'.length).trim())).trim()
    } catch {
      return { ok: false, reason: `gsd-tools ${args[0]}: could not read its @file result.` }
    }
  }
  try {
    return { ok: true, value: JSON.parse(text) as T }
  } catch {
    return { ok: false, reason: `gsd-tools ${args[0]}: answered something that is not JSON.` }
  }
}

// ---- palette

const PANE = 'gsd-pilot'
const CARD_BG = 'userMessageBackground'
const CAPTURE_KINDS: Record<string, string> = { todo: '', note: '--note ', seed: '--seed ', backlog: '--backlog ' }

let lastRefresh = 0
let refreshing: Promise<void> | null = null

async function refresh($: EngineInterface): Promise<void> {
  if (refreshing) return refreshing
  refreshing = (async () => {
    try {
      const cwd = await $.session.cwd()
      const [inspect, smart] = await Promise.all([
        gsdJson<InspectJson>($, ['planning', 'inspect']),
        gsdJson<SmartJson>($, ['smart-entry', '--json']),
      ])
      if (!inspect.ok) {
        // Not a GSD project, or gsd-core missing: say so once, draw nothing else.
        await update($, snapshot, () => null)
        await update($, status, () => ({ kind: 'none', text: inspect.reason }))
        return
      }
      const names = new Set((await $.command.list()).map(c => c.name))
      const snap = buildSnapshot(inspect.value, smart.ok ? smart.value : {}, names, cwd, await $.clock.now())
      await update($, snapshot, () => snap)
      await update($, status, () =>
        smart.ok ? { kind: 'ok', text: 'ok' } : { kind: 'error', text: `next-move list unavailable: ${smart.reason}` },
      )
    } catch (err) {
      await update($, status, () => ({ kind: 'error', text: String(err).slice(0, 200) }))
    } finally {
      lastRefresh = await $.clock.now()
      refreshing = null
    }
  })()
  return refreshing
}

function asText(s: PilotSnapshot | null, st: PilotStatus): string {
  if (s === null) return `gsd-pilot: ${st.text}`
  const lines = [`GSD ${s.milestone ?? ''} - ${s.situation}${s.activePhase ? ` - ${s.activePhase}` : ''}`.trim()]
  if (s.verification) lines.push(`Phase ${s.verification.phaseId} verification: ${s.verification.status}`)
  lines.push('', 'Moves that fit now:')
  for (const a of s.actions) lines.push(`- ${a.command}${a.isRecommended ? ' (recommended)' : ''}${a.isAvailable ? '' : ' (not installed)'}  ${a.label}`)
  return lines.join('\n')
}

function statusColor(st: string): string {
  return st === 'passed' ? 'success' : st === 'gaps_found' || st === 'stale' ? 'warning' : st === 'missing' ? 'subtle' : 'warning'
}

function relPath(path: string, cwd: string): string {
  const base = cwd.replace(/\/$/, '') + '/'
  return path.startsWith(base) ? path.slice(base.length) : path
}

async function filesFor($: EngineInterface, s: PilotSnapshot, kind: string, id: string): Promise<string[] | string> {
  const phasesDir = `${s.planningRoot}/phases`
  let dirs: string[] = []
  try {
    dirs = (await $.fs.list(phasesDir)).filter(d => d.kind === 'dir').map(d => d.name)
  } catch {
    return `No phases folder at ${phasesDir}.`
  }
  if (kind === 'phase') {
    const want = id.padStart(2, '0')
    const dir = dirs.find(d => d === want || d.startsWith(`${want}-`))
    if (!dir) return `No phase ${id} under ${phasesDir}.`
    const files = (await $.fs.list(`${phasesDir}/${dir}`)).filter(f => f.kind === 'file' && f.name.endsWith('.md')).map(f => f.name)
    const keep = files.filter(f => /-(CONTEXT|RESEARCH|VERIFICATION|UAT)\.md$/.test(f) || /-PLAN\.md$/.test(f))
    return (keep.length > 0 ? keep : files).sort().map(f => `${phasesDir}/${dir}/${f}`)
  }
  // plan NN-MM: its PLAN and, once written, its SUMMARY.
  const m = id.match(/^(\d+(?:\.\d+)?)-(\d+)$/)
  if (!m) return 'A plan id looks like 03-02.'
  const want = (m[1] ?? '').padStart(2, '0')
  const dir = dirs.find(d => d === want || d.startsWith(`${want}-`))
  if (!dir) return `No phase ${m[1]} under ${phasesDir}.`
  const files = (await $.fs.list(`${phasesDir}/${dir}`)).map(f => f.name)
  const out = files.filter(f => f === `${id}-PLAN.md` || f === `${id}-SUMMARY.md`).sort()
  if (out.length === 0) return `No ${id}-PLAN.md in ${dir}.`
  return out.map(f => `${phasesDir}/${dir}/${f}`)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'gsd', description: 'GSD palette: the moves that fit now, one key away' })
    await $.command.register({
      name: 'gsd-grab',
      description: 'Capture the text you selected as a GSD todo, note, seed or backlog item',
      argumentHint: '[todo|note|seed|backlog]',
    })
    await $.command.register({
      name: 'gsd-attach',
      description: "Attach a GSD phase's or plan's files to your next prompt",
      argumentHint: 'phase <N> | plan <NN-MM>',
    })
    void refresh($)
    return next(e)
  })

  // After each main-loop turn, re-read: the agent may have moved GSD state on.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined && (await $.clock.now()) - lastRefresh > 2_000) void refresh($)
    return result
  })

  on('command.run', { command: 'gsd' }, async $ => {
    await refresh($)
    const opened = await $.ui.open({ id: PANE, title: 'GSD pilot' })
    if (opened.isPlaced) return { text: 'Opened the GSD pilot.' }
    return { text: asText(await read($, snapshot), await read($, status)) }
  })

  on('command.run', { command: 'gsd-grab' }, async ($, e) => {
    const kind = e.args.trim().toLowerCase() || 'todo'
    const flag = CAPTURE_KINDS[kind]
    if (flag === undefined) return { text: 'gsd-grab takes todo, note, seed or backlog.' }
    const picked = await $.ui.selection()
    if (picked === undefined || picked.text.trim() === '') {
      return { text: 'Select some text in the transcript first (fullscreen terminal), then run /gsd-grab.' }
    }
    const body = picked.text.replace(/\s+/g, ' ').trim().slice(0, 600)
    await $.prompt.fill({ text: `/gsd-capture ${flag}${body}`, mode: 'replace' })
    return { text: `Filled /gsd-capture ${flag.trim() || '(todo)'} with your selection. Press Enter to capture it.` }
  })

  on('command.run', { command: 'gsd-attach' }, async ($, e) => {
    const [kind, id] = e.args.trim().split(/\s+/)
    if ((kind !== 'phase' && kind !== 'plan') || !id) return { text: 'Usage: /gsd-attach phase <N> | plan <NN-MM>' }
    await refresh($)
    const s = await read($, snapshot)
    if (s === null) return { text: `gsd-attach: ${(await read($, status)).text}` }
    const found = await filesFor($, s, kind, id)
    if (typeof found === 'string') return { text: `gsd-attach: ${found}` }
    const cwd = await $.session.cwd()
    await $.prompt.fill({ text: found.map(f => `@${relPath(f, cwd)}`).join(' ') + ' ', mode: 'insert' })
    return { text: `Attached ${found.length} file(s) from ${kind} ${id} to your prompt.` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const s = await read($, snapshot)
    const st = await read($, status)
    if (s === null) {
      return (
        <Box flexDirection="column">
          <Text color="subtle">{st.text}</Text>
          <Button key="refresh" label="Refresh" hotkey="r" onPress={() => refresh($)} />
        </Box>
      )
    }
    const fill = (a: PilotAction) => () => $.prompt.fill({ text: a.command, mode: 'replace' })
    return (
      <Box flexDirection="column">
        <Box>
          <Text color="claude" bold>
            {`GSD ${s.milestone ?? ''}`}
          </Text>
          <Text>{`  ${s.situation}`}</Text>
          {s.progress && <Text color="subtle">{`  ${s.progress}`}</Text>}
        </Box>
        {s.activePhase && <Text color="subtle" wrap="truncate-end">{`Active: ${s.activePhase}`}</Text>}
        {s.isElsewhere && <Text color="subtle" wrap="truncate-middle">{`Reading ${s.planningRoot}`}</Text>}

        {s.verification && (
          <Box
            key="verify"
            flexDirection="column"
            marginTop={1}
            paddingX={1}
            borderStyle="round"
            borderColor={statusColor(s.verification.status)}
            backgroundColor={CARD_BG}
          >
            <Box>
              <Text bold>{`Phase ${s.verification.phaseId} verification `}</Text>
              <Text color={statusColor(s.verification.status)} inverse>
                {` ${s.verification.status.toUpperCase()} `}
              </Text>
            </Box>
            <Text color="subtle" wrap="truncate-end">
              {s.verification.nextAction}
            </Text>
            {s.verification.command && (
              <Button
                key="verify-go"
                label={s.verification.command}
                hotkey="v"
                onPress={() => $.prompt.fill({ text: s.verification!.command!, mode: 'replace' })}
              />
            )}
          </Box>
        )}

        <Box
          key="moves"
          flexDirection="column"
          marginTop={1}
          paddingX={1}
          borderStyle="round"
          borderColor="claude"
          backgroundColor={CARD_BG}
        >
          <Text bold>Moves that fit now</Text>
          {s.actions.length === 0 && <Text color="subtle">{st.kind === 'error' ? st.text : 'None offered.'}</Text>}
          {s.actions.slice(0, 9).map((a, i) => (
            <Box key={`move-${i}`}>
              <Button
                key={`go-${i}`}
                label={a.command}
                hotkey={String(i + 1)}
                variant={a.isRecommended ? 'primary' : 'secondary'}
                onPress={a.isAvailable ? fill(a) : () => undefined}
              />
              <Text color={a.isAvailable ? 'text' : 'subtle'} wrap="truncate-end">
                {`  ${a.label}${a.isRecommended ? '  (recommended)' : ''}${a.isAvailable ? '' : '  (not installed)'}`}
              </Text>
            </Box>
          ))}
        </Box>
        <Box marginTop={1}>
          <Button key="refresh" label="Refresh" hotkey="r" onPress={() => refresh($)} />
          <Text color="subtle">{'  Buttons fill the prompt; you press Enter. Keys: ctrl+x, tab, then 1-9 / v / r.'}</Text>
        </Box>
      </Box>
    )
  })
}
