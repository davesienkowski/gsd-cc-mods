import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { classify } from '../hooks/classify'

// Texts copied from gsd-core/hooks on `next` (2026-10-06).
const WARNING =
  'CONTEXT WARNING: Usage at 66%. Remaining: 34%. Context is getting limited. Avoid starting new complex work.'
const CRITICAL =
  'CONTEXT CRITICAL: Usage at 76%. Remaining: 24%. GSD state is being saved. Stop and save state now.'
const READ_GUARD =
  'READ-BEFORE-EDIT REMINDER: You are about to modify "STATE.md" which already exists. If you have not already used the Read tool...'
const SECRET =
  "Secret read guard: Read would read '/work/.env', which matches a protected secret-file pattern (.env*). Secret values must not be read into the conversation."

function quiet(on: On, said: { logs: string[]; toasts: string[] }) {
  const clock = mock.clock(on)
  on('ui.log', ($, e) => {
    said.logs.push(e.text)
    return { value: undefined }
  })
  on('ui.toast', ($, e) => {
    said.toasts.push(e.text)
    return { value: undefined }
  })
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('tool.register', ($, e) => ({ value: { tool: `mcp__gsd-whisper__${e.name}` } }))
  return clock
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
    expect(classify('⚠️ WORKFLOW ADVISORY: You\'re editing app.ts directly without a GSD command.')?.rule).toBe(
      'workflow-guard',
    )
    expect(classify('.planning/ file modified: .planning/STATE.md\nCheck: Should STATE.md be updated?')?.rule).toBe(
      'phase-boundary',
    )
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
  test('a gsd-core advisory is shown and passed on unchanged', async ($, on) => {
    const said = { logs: [] as string[], toasts: [] as string[] }
    const clock = quiet(on, said)
    on('classic.PostToolUse', () => ({ additionalContext: [WARNING, 'praxis: unrelated note'] }))

    const result = await $.classic.PostToolUse({
      tool_name: 'Edit',
      tool_input: {},
      tool_response: {},
      tool_use_id: 'tu1',
    } as never)
    await clock.settle()

    expect(result.additionalContext).toEqual([WARNING, 'praxis: unrelated note'])
    expect(said.logs).toEqual(['GSD told the agent: context warning (34% left): agent told to wrap up'])
    expect(said.toasts.length).toBe(1)
  })

  test('a repeat within a minute is recorded but said once', async ($, on) => {
    const said = { logs: [] as string[], toasts: [] as string[] }
    const clock = quiet(on, said)
    on('classic.PostToolUse', () => ({ additionalContext: [READ_GUARD] }))
    const input = { tool_name: 'Edit', tool_input: {}, tool_response: {}, tool_use_id: 'tu' } as never

    await $.classic.PostToolUse(input)
    await $.classic.PostToolUse(input)
    await clock.settle()

    expect(said.logs.length).toBe(1)
  })

  test('a gsd-core deny reaches the person, and the call stays refused', async ($, on) => {
    const said = { logs: [] as string[], toasts: [] as string[] }
    const clock = quiet(on, said)
    on('classic.PreToolUse', () => ({ deny: SECRET }))

    const ran = await $.tool.call({ tool: 'Read', file_path: '/work/.env' } as never)
    await clock.settle()

    expect((ran as { isError?: boolean }).isError).toBe(true)
    expect(said.logs[0]).toContain('GSD blocked Read')
    expect(said.logs[0]).toContain('Secret read guard')
  })

  test('hook output that is not gsd-core says nothing', async ($, on) => {
    const said = { logs: [] as string[], toasts: [] as string[] }
    const clock = quiet(on, said)
    on('classic.Stop', () => ({ additionalContext: ['some other plugin note'] }))

    await $.classic.Stop({ stop_hook_active: false } as never)
    await clock.settle()

    expect(said.logs).toEqual([])
    expect(said.toasts).toEqual([])
  })

  test('/gsd-whisper reports what was seen', async ($, on) => {
    const said = { logs: [] as string[], toasts: [] as string[] }
    const clock = quiet(on, said)
    on('classic.PostToolUse', () => ({ additionalContext: [CRITICAL] }))

    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    await $.classic.PostToolUse({ tool_name: 'Bash', tool_input: {}, tool_response: {}, tool_use_id: 'tu2' } as never)
    const { text } = await $.command.run({ command: 'gsd-whisper', args: '', origin: { kind: 'composer' } } as never)

    expect(text).toContain('context-critical')
    expect(text).toContain('classic.PostToolUse: 1 / 1')
  })

  test('at CRITICAL the band offers Pause, which fills and does not send', async ($, on) => {
    const said = { logs: [] as string[], toasts: [] as string[] }
    const clock = quiet(on, said)
    const filled: string[] = []
    on('prompt.fill', ($, e) => {
      filled.push(e.text)
      return { isFilled: true }
    })
    on('ui.render', ($, e) => {
      const { Box } = $.ui.resolve(e)
      return h(Box, { key: 'engine-band' }) as never
    })
    on('classic.PostToolUse', () => ({ additionalContext: [CRITICAL] }))
    const BAND = {
      component: 'AbovePrompt',
      props: { hasSurvey: false, isWorking: false, maxRows: 3, bodyColumns: 100, scroll: { offset: 0, bodyRows: 3 }, view: {} },
    } as const

    for (const surface of ['terminal', 'desktop'] as const) {
      const before = await $.ui.mount({ plugin: 'gsd-whisper', surface, ...BAND })
      expect(await before.find({ key: 'pause' })).toBeUndefined()
      await before.unmount()
    }

    await $.classic.PostToolUse({ tool_name: 'Bash', tool_input: {}, tool_response: {}, tool_use_id: 'tu3' } as never)
    await clock.settle()

    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ plugin: 'gsd-whisper', surface, ...BAND })
      expect(await ui.find({ key: 'pause' })).toBeDefined()
      await ui.press({ key: 'pause' })
      await ui.unmount()
    }
    expect(filled).toEqual(['/gsd-pause-work', '/gsd-pause-work'])
  })
})
