import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { MAIN_SCREEN_HINT, waitingHint } from '../hooks/register'
import { buildSnapshot, resolveCommand } from '../hooks/snapshot'

// Shapes as gsd-tools 1.16 answered them on a real project (2026-10-06).
const INSPECT = {
  generated_from: { cwd: '/work', planning_root: '/work/.planning' },
  milestone: { version: 'v2.0', name: null },
  active: { phase: { value: 'Phase 1: pilot' }, plan: { value: '—' }, status: { value: 'executing' } },
  phases: [
    {
      dir: '01-pilot',
      phase_id: '01',
      complete: false,
      verification: { status: 'missing', next_action: 'No verification report found.', route: 'execute-phase' },
    },
  ],
}
const SMART = {
  situation: 'executing',
  actions: [
    { id: 'progress-next', label: 'Advance to the next step', command: '/gsd:progress --next', recommended: true },
    { id: 'quick', label: 'Quick task', command: '/gsd:quick', recommended: false },
    { id: 'ghost', label: 'Not installed here', command: '/gsd:ghost', recommended: false },
  ],
}
const NAMES = ['gsd-progress', 'gsd-quick', 'gsd-execute-phase', 'gsd-capture']
const TOOLS = '/home/u/.claude/gsd-core/bin/gsd-tools.cjs'

describe('snapshot', () => {
  test('commands use the spelling the session lists', async () => {
    const names = new Set(NAMES)
    expect(resolveCommand('/gsd:progress --next', names)).toEqual({ command: '/gsd-progress --next', isAvailable: true })
    expect(resolveCommand('/gsd-quick', names)).toEqual({ command: '/gsd-quick', isAvailable: true })
    expect(resolveCommand('/gsd:ghost', names).isAvailable).toBe(false)
    expect(resolveCommand('/gsd:progress', new Set(['gsd:progress']))).toEqual({ command: '/gsd:progress', isAvailable: true })
  })

  test('the snapshot names the first open phase and its route, never a guess', async () => {
    const s = buildSnapshot(INSPECT, SMART, new Set(NAMES), '/work', 5)
    expect(s.verification).toEqual({
      phaseId: '01',
      phaseDir: '01-pilot',
      status: 'missing',
      nextAction: 'No verification report found.',
      command: '/gsd-execute-phase 01',
    })
    expect(s.isElsewhere).toBe(false)
    expect(s.milestone).toBe('v2.0')
    expect(buildSnapshot({ ...INSPECT, phases: [{ ...INSPECT.phases[0]!, complete: true }] }, SMART, new Set(NAMES), '/work', 5).verification).toBeNull()
    expect(buildSnapshot(INSPECT, SMART, new Set(NAMES), '/work/worktree', 5).isElsewhere).toBe(true)
  })
})

type WorldOpts = { installed?: boolean; selection?: string; layout?: boolean; placed?: boolean; hinted?: boolean }

function world(on: On, opts: WorldOpts = {}) {
  const filled: string[] = []
  const ran: string[][] = []
  const opened: Array<{ columns?: number; rows?: number }> = []
  const toasts: string[] = []
  const store = new Map<string, unknown>()
  if (opts.layout !== undefined) store.set('fullscreen', opts.layout)
  if (opts.hinted) store.set('hinted-main-screen', true)
  mock.clock(on)
  on('env.get', ($, e) => ({ value: e.name === 'HOME' ? '/home/u' : undefined }) as never)
  on('fs.exists', ($, e) => ({ value: opts.installed !== false && e.path === TOOLS }) as never)
  on('session.cwd', () => ({ value: '/work' }) as never)
  on('process.run', ($, e) => {
    ran.push([...e.argv])
    const verb = e.argv.slice(2).join(' ')
    const out = verb.startsWith('runtime-identity')
      ? '{"packageName":"@opengsd/gsd-core","version":"1.16.0"}'
      : verb.startsWith('planning inspect')
        ? JSON.stringify(INSPECT)
        : verb.startsWith('smart-entry')
          ? JSON.stringify(SMART)
          : ''
    return { value: { exitCode: 0, stdout: out, stderr: 'gsd-tools: warning: a config note on stderr' } } as never
  })
  on('command.list', () => ({ value: NAMES.map(name => ({ name })) }) as never)
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
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
  on('ui.selection', () => ({ value: opts.selection === undefined ? undefined : { text: opts.selection } }) as never)
  on('prompt.fill', ($, e) => {
    filled.push(e.text)
    return { isFilled: true }
  })
  on('fs.list', ($, e) => {
    const entries =
      e.path === '/work/.planning/phases'
        ? [{ name: '01-pilot', kind: 'dir', size: 0 }]
        : [
            { name: '01-CONTEXT.md', kind: 'file', size: 1 },
            { name: '01-01-PLAN.md', kind: 'file', size: 1 },
            { name: '01-01-SUMMARY.md', kind: 'file', size: 1 },
            { name: 'notes.txt', kind: 'file', size: 1 },
          ]
    return { value: entries } as never
  })
  return { filled, ran, opened, toasts, store }
}

// Lets the unawaited refresh-then-open chain behind session.start settle. The
// test runner has timers; the mod environment (and so its typings) has none.
declare const setTimeout: (fn: () => void, ms: number) => unknown
const settle = () => new Promise<void>(resolve => setTimeout(resolve, 150))

const PANE = {
  plugin: 'gsd-pilot',
  component: 'Pane',
  requestId: 'gsd-pilot',
  props: { title: 'GSD pilot', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 30 } },
} as never

const run = (command: string, args = '') =>
  ({ command, args, origin: { kind: 'composer' } }) as never

describe('register', () => {
  test('/gsd opens a palette whose buttons fill, never send, the right command', async ($, on) => {
    const { filled, ran } = world(on)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    const { text } = await $.command.run(run('gsd'))
    expect(text).toBe('Opened the GSD pilot.')
    // Only the installed gsd-tools ever runs, proven first.
    expect(ran.every(a => a[0] === 'node' && a[1] === TOOLS)).toBe(true)
    expect(ran.some(a => a[2] === 'runtime-identity')).toBe(true)

    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ ...(PANE as object), surface } as never)
      expect(await ui.find({ type: 'Text', text: /MISSING/ })).toBeDefined()
      await ui.press({ key: 'go-0' })
      await ui.press({ key: 'verify-go' })
      await ui.press({ key: 'go-2' })
      await ui.unmount()
    }
    // The not-installed move fills nothing.
    expect(filled).toEqual(['/gsd-progress --next', '/gsd-execute-phase 01', '/gsd-progress --next', '/gsd-execute-phase 01'])
  })

  test('outside a GSD install the palette says why and offers nothing', async ($, on) => {
    world(on, { installed: false })
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    await $.command.run(run('gsd'))
    const ui = await $.ui.mount({ ...(PANE as object), surface: 'terminal' } as never)
    expect(await ui.find({ type: 'Text', text: /not installed/ })).toBeDefined()
    expect(await ui.find({ key: 'go-0' })).toBeUndefined()
    await ui.unmount()
  })

  test('/gsd-grab fills /gsd-capture with the selection', async ($, on) => {
    const { filled } = world(on, { selection: 'retry the\n  flaky login test' })
    expect((await $.command.run(run('gsd-grab', 'seed'))).text).toContain('Press Enter')
    expect(filled).toEqual(['/gsd-capture --seed retry the flaky login test'])
    expect((await $.command.run(run('gsd-grab', 'nonsense'))).text).toContain('todo, note, seed or backlog')
  })

  test('/gsd-grab with nothing selected says so and fills nothing', async ($, on) => {
    const { filled } = world(on)
    expect((await $.command.run(run('gsd-grab'))).text).toContain('Select some text')
    expect(filled).toEqual([])
  })

  test('/gsd-attach puts @-mentions for a phase or a plan into the prompt', async ($, on) => {
    const { filled } = world(on)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    expect((await $.command.run(run('gsd-attach', 'phase 1'))).text).toContain('Attached 2 file(s)')
    expect((await $.command.run(run('gsd-attach', 'plan 01-01'))).text).toContain('Attached 2 file(s)')
    expect(filled).toEqual([
      '@.planning/phases/01-pilot/01-01-PLAN.md @.planning/phases/01-pilot/01-CONTEXT.md ',
      '@.planning/phases/01-pilot/01-01-PLAN.md @.planning/phases/01-pilot/01-01-SUMMARY.md ',
    ])
    expect((await $.command.run(run('gsd-attach', 'phase 7'))).text).toContain('No phase 7')
    expect((await $.command.run(run('gsd-attach', 'banana'))).text).toContain('Usage')
  })

  test('a fullscreen session docks the pane on start, at the gsd-status-mod size', async ($, on) => {
    const { opened, toasts } = world(on, { layout: true })
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    await settle()
    expect(opened).toEqual([{ columns: 64, rows: 18 }])
    expect(toasts).toEqual([])
  })

  test('openOnStart off: nothing opens unasked', { options: { openOnStart: false } }, async ($, on) => {
    const { opened } = world(on, { layout: true })
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    await settle()
    expect(opened).toEqual([])
  })

  test('main-screen layout: no unasked pane, one hint ever, and /gsd says how to dock', async ($, on) => {
    const { opened, toasts, store } = world(on, { layout: false })
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    await settle()
    expect(opened).toEqual([])
    expect(toasts).toEqual([`gsd-pilot: ${MAIN_SCREEN_HINT}`])
    expect(store.get('hinted-main-screen')).toBe(true)
    const { text } = await $.command.run({ ...(run('gsd') as object), presentation: { isFullscreen: false, columns: 96 } } as never)
    expect(text).toContain('/tui fullscreen')
  })

  test('main-screen layout already hinted: stays quiet', async ($, on) => {
    const { toasts } = world(on, { layout: false, hinted: true })
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    await settle()
    expect(toasts).toEqual([])
  })

  test('a narrow Orca split: the waiting pane says why instead of failing silently', async ($, on) => {
    const { toasts } = world(on, { layout: true, placed: false })
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    await settle()
    expect(toasts).toEqual([waitingHint('opened unasked below 144 columns (now 96).')])
    expect(toasts[0]).toContain('Run /gsd to open it now.')
  })

  test('layout unknown (first session): waits for a render to say', async ($, on) => {
    const { opened, toasts } = world(on)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    await settle()
    expect(opened).toEqual([])
    expect(toasts).toEqual([])
  })

  test('outside a GSD project nothing opens unasked', async ($, on) => {
    const { opened } = world(on, { layout: true, installed: false })
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    await settle()
    expect(opened).toEqual([])
  })
})
