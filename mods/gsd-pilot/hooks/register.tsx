import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren } from 'claude-code'

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
const CAPTURE_KINDS: Record<string, string> = { todo: '', note: '--note ', seed: '--seed ', backlog: '--backlog ' }

// ---- pane placement: the gsd-status-mod setup (a docked pane opened at
// session start, `openOnStart` to turn that off), plus what it leaves out.
//
// A pane docks beside the transcript only in Claude Code's fullscreen layout
// (`/tui fullscreen`); on the main screen it sits inline above the prompt. So
// the pilot opens unasked only where it would be a sidebar, and says why it is
// waiting instead of failing silently: in an Orca split the terminal is often
// under the 144 columns an unasked pane needs (110 once /gsd has opened it).

const PANE_SIZE = { columns: 64, rows: 18 }
const LAYOUT_KEY = 'fullscreen'
const HINTED_KEY = 'hinted-main-screen'

let openOnStart = true
let fullscreen: boolean | undefined // as a render or command last reported it; fixed per session
let autoTried = false
let closedByHand = false

export const MAIN_SCREEN_HINT =
  'Claude Code is on its main-screen layout, so the pane sits above the prompt. Run /tui fullscreen to dock it on the right (Orca included).'

export function waitingHint(reason: string): string {
  return `GSD pilot pane is waiting: ${reason.replace(/\.?\s*$/, '.')} Run /gsd to open it now.`
}

function noteLayout(v: { isFullscreen?: boolean } | undefined): void {
  if (typeof v?.isFullscreen === 'boolean') fullscreen = v.isFullscreen
}

async function keepLayout($: EngineInterface): Promise<void> {
  if (fullscreen !== undefined && (await $.store.get(LAYOUT_KEY)) !== fullscreen) await $.store.set(LAYOUT_KEY, fullscreen)
}

// The unasked open, tried once per session as soon as the layout is known:
// this session's (from a render) or, before the first render, the last one's.
async function autoOpen($: EngineInterface): Promise<void> {
  if (autoTried || closedByHand || !openOnStart) return
  if ((await read($, snapshot)) === null) return
  const stored = await $.store.get(LAYOUT_KEY)
  const layout = fullscreen ?? (typeof stored === 'boolean' ? stored : undefined)
  if (layout === undefined) return
  autoTried = true
  if (!layout) {
    if ((await $.store.get(HINTED_KEY)) !== true) {
      await $.store.set(HINTED_KEY, true)
      $.ui.toast(`gsd-pilot: ${MAIN_SCREEN_HINT}`)
    }
    return
  }
  const opened = await $.ui.open({ id: PANE, title: 'GSD pilot', ...PANE_SIZE })
  if (!opened.isPlaced) $.ui.toast(waitingHint(opened.reason))
}

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

export const register: Register = (on, options) => {
  openOnStart = options.openOnStart !== false
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
    // Read first: the pane opens unasked only in a GSD project.
    if (e.isInteractive) void refresh($).then(() => autoOpen($))
    else void refresh($)
    return next(e)
  })

  // After each main-loop turn, re-read: the agent may have moved GSD state on.
  // The first turn also settles the layout a first-ever session did not know.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined) {
      if ((await $.clock.now()) - lastRefresh > 2_000) void refresh($).then(() => autoOpen($))
      else void autoOpen($)
      void keepLayout($)
    }
    return result
  })

  on('command.run', { command: 'gsd' }, async ($, e) => {
    noteLayout(e.presentation)
    closedByHand = false
    await refresh($)
    const opened = await $.ui.open({ id: PANE, title: 'GSD pilot', ...PANE_SIZE })
    void keepLayout($)
    if (opened.isPlaced) return { text: `Opened the GSD pilot.${e.presentation?.isFullscreen === false ? ` ${MAIN_SCREEN_HINT}` : ''}` }
    return { text: asText(await read($, snapshot), await read($, status)) }
  })

  // Closed with its close mark (or ctrl+x x): not reopened unasked this session.
  on('ui.close', { id: PANE }, async ($, e, next) => {
    const result = await next(e)
    if (e.origin.kind === 'person') closedByHand = true
    return result
  }).catch(($, e, next) => next(e))

  // Nothing drawn here: the band is where the layout is known before any pane is.
  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    noteLayout(e.viewport)
    return next(e)
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

  // The palette, drawn as gsd-status-mod draws its pane: a centred header, then
  // one round-bordered panel per topic, its title left and a note on the right.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    noteLayout(e.viewport)
    const W = Math.max(40, e.props.bodyColumns)
    const s = await read($, snapshot)
    const st = await read($, status)
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
    const footer = (
      <Box key="footer">
        <Button key="refresh" label="refresh" plain hotkey="r" onPress={() => refresh($)} />
        <Text color="subtle" wrap="truncate">
          {'  buttons fill the prompt; keys after ctrl+x, tab'}
        </Text>
      </Box>
    )
    if (s === null) {
      return (
        <Box flexDirection="column" width={W}>
          <Box justifyContent="center">
            <Text bold>GSD pilot</Text>
          </Box>
          {panel('none', 'subtle', 'no GSD project here', null, [
            <Text key="why" color="subtle">
              {st.text}
            </Text>,
          ])}
          {footer}
        </Box>
      )
    }
    const fill = (a: PilotAction) => () => $.prompt.fill({ text: a.command, mode: 'replace' })
    const v = s.verification
    return (
      <Box flexDirection="column" width={W}>
        <Box justifyContent="center">
          <Text bold wrap="truncate">
            <Text color="claude">GSD pilot</Text>
            {s.milestone ? ` · ${s.milestone}` : ''}
          </Text>
        </Box>
        {panel(
          'state',
          'claude',
          s.situation,
          s.progress ? <Text color="subtle">{s.progress}</Text> : null,
          [
            s.activePhase ? (
              <Text key="active" wrap="truncate-end">
                {`active  ${s.activePhase}`}
              </Text>
            ) : null,
            s.isElsewhere ? (
              <Text key="where" color="subtle" wrap="truncate-middle">
                {`reading ${s.planningRoot}`}
              </Text>
            ) : null,
          ],
        )}
        {v &&
          panel(
            'verify',
            statusColor(v.status),
            `phase ${v.phaseId} verification`,
            <Text color={statusColor(v.status)} inverse>
              {` ${v.status.toUpperCase()} `}
            </Text>,
            [
              <Text key="next" color="subtle" wrap="truncate-end">
                {v.nextAction}
              </Text>,
              v.command ? (
                <Button
                  key="verify-go"
                  label={v.command}
                  plain
                  hotkey="v"
                  onPress={() => $.prompt.fill({ text: v.command!, mode: 'replace' })}
                />
              ) : null,
            ],
          )}
        {panel(
          'moves',
          'claude',
          'moves that fit now',
          <Text color="subtle">{s.actions.length > 0 ? `1-${Math.min(9, s.actions.length)}` : ''}</Text>,
          [
            s.actions.length === 0 ? (
              <Text key="none" color="subtle">
                {st.kind === 'error' ? st.text : 'None offered.'}
              </Text>
            ) : null,
            ...s.actions.slice(0, 9).map((a, i) => (
              <Box key={`move-${i}`}>
                <Button
                  key={`go-${i}`}
                  label={a.command}
                  plain
                  hotkey={String(i + 1)}
                  onPress={a.isAvailable ? fill(a) : () => undefined}
                />
                <Text color={a.isRecommended ? 'claude' : a.isAvailable ? 'text' : 'subtle'} wrap="truncate-end">
                  {`  ${a.isRecommended ? '★ ' : ''}${a.label}${a.isAvailable ? '' : '  (not installed)'}`}
                </Text>
              </Box>
            )),
          ],
        )}
        {footer}
      </Box>
    )
  })
}
