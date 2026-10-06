import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { classify } from '../hooks/classify'
import { MAIN_SCREEN_HINT, waitingHint } from '../hooks/register'

// Texts copied from gsd-core/hooks on `next` (2026-10-06).
const WARNING =
  'CONTEXT WARNING: Usage at 66%. Remaining: 34%. Context is getting limited. Avoid starting new complex work.'
const CRITICAL =
  'CONTEXT CRITICAL: Usage at 76%. Remaining: 24%. GSD state is being saved. Stop and save state now.'
const READ_GUARD =
  'READ-BEFORE-EDIT REMINDER: You are about to modify "STATE.md" which already exists. If you have not already used the Read tool...'
const SECRET =
  "Secret read guard: Read would read '/work/.env', which matches a protected secret-file pattern (.env*). Secret values must not be read into the conversation."
const PHASE = '.planning/ file modified: .planning/STATE.md\nCheck: Should STATE.md be updated to reflect this change?'

const ROW = (id: string, tool = 'Edit') => ({
  component: 'ToolUse',
  requestId: id,
  props: { tool_use_id: id, tool, input: {}, isRunning: false, isErrored: false, isInterrupted: false },
}) as const

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 3, bodyColumns: 100, scroll: { offset: 0, bodyRows: 3 }, view: {} },
} as const

const post = (id: string) =>
  ({ tool_name: 'Edit', tool_input: {}, tool_response: {}, tool_use_id: id }) as never

function world(on: On) {
  const said = { toasts: [] as string[], filled: [] as string[] }
  const clock = mock.clock(on)
  on('ui.log', () => ({ value: undefined }))
  on('ui.toast', ($, e) => {
    said.toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('prompt.fill', ($, e) => {
    said.filled.push(e.text)
    return { isFilled: true }
  })
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('tool.register', ($, e) => ({ value: { tool: `mcp__gsd-whisper__${e.name}` } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  // The engine's own drawing, beneath the plugin.
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return h(Box, { key: 'engine' }) as never
  })
  return { said, clock }
}

describe('classify', () => {
  test('recognizes each gsd-core hook message and nothing else', async () => {
    expect(classify(WARNING)?.rule).toBe('context-warning')
    expect(classify(WARNING)?.remainingPct).toBe(34)
    expect(classify(CRITICAL)?.rule).toBe('context-critical')
    expect(classify(READ_GUARD)?.summary).toContain('STATE.md')
    expect(classify(SECRET)?.rule).toBe('secret-read-guard')
    // as the engine hands a settings hook's deny to a mod (seen live on 2.1.291)
    expect(classify('PreToolUse:Read hook error: ' + SECRET)?.rule).toBe('secret-read-guard')
    expect(classify("⚠️ WORKFLOW ADVISORY: You're editing app.ts directly without a GSD command.")?.rule).toBe(
      'workflow-guard',
    )
    expect(classify(PHASE)?.rule).toBe('phase-boundary')
    expect(classify('Commit subject must be 72 characters or less.')?.rule).toBe('validate-commit')
    expect(classify('.planning/ file modified: /tmp/a/b/c/spike/.planning/x.md\nCheck: Should STATE.md be updated?')?.summary).toBe(
      '.planning edit (.../.planning/x.md): agent asked whether STATE.md needs updating',
    )
    expect(classify("Secret read guard: Read would read '/tmp/a/b/c/spike/.env', which matches.")?.summary).toContain(
      "'.../spike/.env'",
    )
    expect(classify('praxis: some other hook said this')).toBeNull()
    expect(classify('')).toBeNull()
  })
})

describe('register', () => {
  test('advice passes on unchanged and badges its own tool row only', async ($, on) => {
    const { clock } = world(on)
    on('classic.PostToolUse', () => ({ additionalContext: [PHASE, 'praxis: unrelated note'] }))

    const result = await $.classic.PostToolUse(post('tu1'))
    await clock.settle()
    expect(result.additionalContext).toEqual([PHASE, 'praxis: unrelated note'])

    for (const surface of ['terminal', 'desktop'] as const) {
      const row = await $.ui.mount({ plugin: 'gsd-whisper', surface, ...ROW('tu1') })
      expect(await row.find({ key: 'engine' })).toBeDefined()
      expect(await row.find({ key: 'gsd-badge-0' })).toBeDefined()
      expect(await row.find({ type: 'Text', text: / ADVISED / })).toBeDefined()
      await row.unmount()

      const other = await $.ui.mount({ plugin: 'gsd-whisper', surface, ...ROW('tu-other') })
      expect(await other.find({ key: 'gsd-badge-0' })).toBeUndefined()
      await other.unmount()
    }
  })

  test('a gsd-core deny badges the refused call, and the call stays refused', async ($, on) => {
    const { clock } = world(on)
    on('classic.PreToolUse', () => ({ deny: 'PreToolUse:Read hook error: ' + SECRET }))

    const ran = await $.tool.call({ tool: 'Read', file_path: '/work/.env', tool_use_id: 'tu9' } as never)
    await clock.settle()
    expect((ran as { isError?: boolean }).isError).toBe(true)

    const row = await $.ui.mount({ plugin: 'gsd-whisper', surface: 'terminal', ...ROW('tu9', 'Read') })
    expect(await row.find({ type: 'Text', text: / BLOCKED / })).toBeDefined()
    expect(await row.find({ key: 'gsd-badge-0' })).toBeDefined()
    expect(await row.find({ type: 'Text', text: /secret-read-guard/ })).toBeDefined()
    await row.unmount()
  })

  test('a message tied to no tool call is a toast, said once a minute', async ($, on) => {
    const { said, clock } = world(on)
    on('classic.SessionStart', () => ({
      additionalContext: ['## Project State Reminder\n\nSTATE.md exists - check for blockers and current phase.'],
    }))
    const input = { source: 'startup' } as never

    await $.classic.SessionStart(input)
    await $.classic.SessionStart(input)
    await clock.settle()

    expect(said.toasts).toEqual(['GSD advised: session start: STATE.md reminder given to the agent'])
  })

  test('hook output that is not gsd-core draws and says nothing', async ($, on) => {
    const { said, clock } = world(on)
    on('classic.PostToolUse', () => ({ additionalContext: ['some other plugin note'] }))

    await $.classic.PostToolUse(post('tu2'))
    await clock.settle()

    expect(said.toasts).toEqual([])
    const row = await $.ui.mount({ plugin: 'gsd-whisper', surface: 'terminal', ...ROW('tu2') })
    expect(await row.find({ key: 'gsd-badge-0' })).toBeUndefined()
    await row.unmount()
  })

  test('/gsd-whisper opens the pane with the history', async ($, on) => {
    const { clock } = world(on)
    on('classic.PostToolUse', () => ({ additionalContext: [PHASE] }))

    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    await $.classic.PostToolUse(post('tu3'))
    await clock.settle()
    const { text } = await $.command.run({ command: 'gsd-whisper', args: '', origin: { kind: 'composer' } } as never)
    expect(text).toBe('Opened the GSD whispers pane.')

    const pane = await $.ui.mount({
      plugin: 'gsd-whisper',
      surface: 'terminal',
      component: 'Pane',
      requestId: 'gsd-whisper',
      props: { title: 'GSD whispers', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 20 } },
    } as never)
    expect(await pane.find({ type: 'Text', text: /1 advised/ })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: /phase-boundary/ })).toBeDefined()
    await pane.unmount()

    const cleared = await $.command.run({ command: 'gsd-whisper', args: 'clear', origin: { kind: 'composer' } } as never)
    expect(cleared.text).toBe('Cleared the GSD whispers history.')
    const empty = await $.ui.mount({
      plugin: 'gsd-whisper',
      surface: 'terminal',
      component: 'Pane',
      requestId: 'gsd-whisper',
      props: { title: 'GSD whispers', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 20 } },
    } as never)
    expect(await empty.find({ type: 'Text', text: /Nothing yet/ })).toBeDefined()
    await empty.unmount()
  })

  test('at CRITICAL the band offers Pause, which fills and does not send', async ($, on) => {
    const { said, clock } = world(on)
    on('classic.PostToolUse', () => ({ additionalContext: [CRITICAL] }))

    for (const surface of ['terminal', 'desktop'] as const) {
      const before = await $.ui.mount({ plugin: 'gsd-whisper', surface, ...BAND })
      expect(await before.find({ key: 'pause' })).toBeUndefined()
      await before.unmount()
    }

    await $.classic.PostToolUse(post('tu4'))
    await clock.settle()
    expect(said.toasts.length).toBe(1)

    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ plugin: 'gsd-whisper', surface, ...BAND })
      expect(await ui.find({ key: 'pause' })).toBeDefined()
      await ui.press({ key: 'pause' })
      await ui.unmount()
    }
    expect(said.filled).toEqual(['/gsd-pause-work', '/gsd-pause-work'])
  })

  test('a folded group leads with the block, not the advice beside it', async ($, on) => {
    const { clock } = world(on)
    on('classic.PostToolUse', () => ({ additionalContext: [PHASE] }))
    on('classic.PreToolUse', () => ({ deny: 'PreToolUse:Read hook error: ' + SECRET }))

    await $.tool.call({ tool: 'Read', file_path: '/work/.env', tool_use_id: 'g1' } as never)
    await $.classic.PostToolUse(post('g2'))
    await clock.settle()

    const group = await $.ui.mount({
      plugin: 'gsd-whisper',
      surface: 'terminal',
      component: 'ToolGroup',
      props: { calls: [{ tool_use_id: 'g1', tool: 'Read' }, { tool_use_id: 'g2', tool: 'Write' }], isActive: false, isExpanded: false },
    } as never)
    expect(await group.find({ type: 'Text', text: / BLOCKED / })).toBeDefined()
    expect(await group.find({ type: 'Text', text: /\+1 more/ })).toBeDefined()
    await group.unmount()
  })
})

// The pane setup taken from gsd-status-mod: when it opens unasked, and what it
// says when it cannot.
declare const setTimeout: (fn: () => void, ms: number) => unknown
const settle = () => new Promise<void>(resolve => setTimeout(resolve, 150))

function placing(on: On, opts: { layout?: boolean; placed?: boolean; isGsd?: boolean } = {}) {
  const opened: Array<{ columns?: number; rows?: number }> = []
  const toasts: string[] = []
  const store = new Map<string, unknown>()
  if (opts.layout !== undefined) store.set('fullscreen', opts.layout)
  on('ui.open', ($, e) => {
    opened.push({ columns: e.columns, rows: e.rows })
    return { value: opts.placed === false ? { isPlaced: false, reason: 'opened unasked below 144 columns (now 96).' } : { isPlaced: true } } as never
  })
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined } as never
  })
  on('store.get', ($, e) => ({ value: store.get(e.key) }) as never)
  on('store.set', ($, e) => {
    store.set(e.key, e.value)
    return { value: undefined } as never
  })
  on('session.cwd', () => ({ value: '/work' }) as never)
  on('fs.exists', ($, e) => ({ value: opts.isGsd !== false && e.path === '/work/.planning/STATE.md' }) as never)
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('tool.register', ($, e) => ({ value: { tool: `mcp__gsd-whisper__${e.name}` } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  return { opened, toasts, store }
}

describe('pane placement', () => {
  test('off by default: a fullscreen GSD session opens nothing unasked', async ($, on) => {
    const { opened } = placing(on, { layout: true })
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    await settle()
    expect(opened).toEqual([])
  })

  test('openOnStart on: docks at the gsd-status-mod size', { options: { openOnStart: true } }, async ($, on) => {
    const { opened } = placing(on, { layout: true })
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    await settle()
    expect(opened).toEqual([{ columns: 64, rows: 16 }])
  })

  test('openOnStart on, not a GSD project: nothing opens', { options: { openOnStart: true } }, async ($, on) => {
    const { opened } = placing(on, { layout: true, isGsd: false })
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    await settle()
    expect(opened).toEqual([])
  })

  test('openOnStart on, main screen: a one-time hint instead of an inline pane', { options: { openOnStart: true } }, async ($, on) => {
    const { opened, toasts, store } = placing(on, { layout: false })
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    await settle()
    expect(opened).toEqual([])
    expect(toasts).toEqual([`gsd-whisper: ${MAIN_SCREEN_HINT}`])
    expect(store.get('hinted-main-screen')).toBe(true)
  })

  test('openOnStart on, narrow Orca split: says why it waits', { options: { openOnStart: true } }, async ($, on) => {
    const { toasts } = placing(on, { layout: true, placed: false })
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    await settle()
    expect(toasts).toEqual([waitingHint('opened unasked below 144 columns (now 96).')])
  })

  test('/gsd-whisper on the main screen says how to dock it', async ($, on) => {
    placing(on)
    const { text } = await $.command.run({
      command: 'gsd-whisper',
      args: '',
      origin: { kind: 'composer' },
      presentation: { isFullscreen: false, columns: 96 },
    } as never)
    expect(text).toContain('/tui fullscreen')
  })
})
