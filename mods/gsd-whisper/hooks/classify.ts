// Recognizes the text gsd-core's own hooks hand the model, so it can be shown
// to the person. Patterns are the openings of each hook's message as written
// in gsd-core/hooks/ on `next` (2026-10-06). An unknown text returns null: the
// mod never guesses which hook wrote something.

export type Recognized = {
  rule: string
  summary: string
  usedPct?: number
  remainingPct?: number
}

type Rule = {
  rule: string
  test: RegExp
  summary: (m: RegExpMatchArray, text: string) => string
}

const firstSentence = (text: string, max = 140): string => {
  const one = text.replace(/\s+/g, ' ').trim()
  const cut = one.search(/\.\s/)
  const head = cut > 0 ? one.slice(0, cut + 1) : one
  return head.length > max ? head.slice(0, max - 3) + '...' : head
}

const RULES: Rule[] = [
  {
    rule: 'context-critical',
    test: /^CONTEXT CRITICAL: Usage at (\d+)%\. Remaining: (\d+)%/,
    summary: m => `context CRITICAL (${m[2]}% left): agent told to stop and save state`,
  },
  {
    rule: 'context-warning',
    test: /^CONTEXT WARNING: Usage at (\d+)%\. Remaining: (\d+)%/,
    summary: m => `context warning (${m[2]}% left): agent told to wrap up`,
  },
  {
    rule: 'read-guard',
    test: /^READ-BEFORE-EDIT REMINDER: You are about to modify "([^"]+)"/,
    summary: m => `read-before-edit reminder for ${m[1]}`,
  },
  {
    rule: 'prompt-guard',
    test: /PROMPT INJECTION WARNING: Content being written to (\S+)/,
    summary: m => `prompt-injection warning on write to ${m[1]}`,
  },
  {
    rule: 'workflow-guard',
    test: /WORKFLOW ADVISORY: You're editing (\S+) directly without a GSD command/,
    summary: m => `editing ${m[1]} outside a GSD command (suggests /gsd-quick)`,
  },
  {
    rule: 'workflow-guard',
    test: /^(agent\/worktree-agent branches must not run git add -f|workflow guard internal error)/,
    summary: (_m, t) => firstSentence(t),
  },
  {
    rule: 'read-injection-scanner',
    test: /INJECTION SCAN \[(\w+)\] \((\w+)\)/,
    summary: m => `injection scan ${m[1]} on ${m[2]} output`,
  },
  {
    rule: 'read-injection-scanner',
    test: /^Prompt-injection blocked \((\w+)\)/,
    summary: m => `prompt injection blocked in ${m[1]} output`,
  },
  {
    rule: 'phase-boundary',
    test: /^\.planning\/ file modified: (.+)/,
    summary: m => `.planning edit (${(m[1] ?? '').trim()}): agent asked whether STATE.md needs updating`,
  },
  {
    rule: 'session-state',
    test: /^## Project State Reminder/,
    summary: () => 'session start: STATE.md reminder given to the agent',
  },
  {
    rule: 'config-reload',
    test: /^GSD config (reloaded|\(\.planning\/config\.json\) was deleted)/,
    summary: m => (m[1] === 'reloaded' ? 'config.json reloaded; summary given to the agent' : 'config.json deleted; agent told defaults apply'),
  },
  {
    rule: 'worktree-path-guard',
    test: /^Worktree path guard: /,
    summary: (_m, t) => firstSentence(t),
  },
  {
    rule: 'write-guard',
    test: /^Write guard: /,
    summary: (_m, t) => firstSentence(t),
  },
  {
    rule: 'agent-isolation-guard',
    test: /^Agent isolation guard: /,
    summary: (_m, t) => firstSentence(t),
  },
  {
    rule: 'secret-read-guard',
    test: /^Secret read guard: /,
    summary: (_m, t) => firstSentence(t),
  },
  {
    rule: 'validate-commit',
    test: /^(Commit message must follow Conventional Commits|Commit subject must be 72 characters or less)/,
    summary: (_m, t) => firstSentence(t),
  },
]

// Hooks prefix some texts with a warning sign; ignore leading symbols and space.
const strip = (text: string) => text.replace(/^[^A-Za-z#.]+/, '')

export const classify = (text: string): Recognized | null => {
  const body = strip(text)
  for (const r of RULES) {
    const m = body.match(r.test)
    if (m) {
      const out: Recognized = { rule: r.rule, summary: r.summary(m, body) }
      if (r.rule.startsWith('context-')) {
        out.usedPct = Number(m[1])
        out.remainingPct = Number(m[2])
      }
      return out
    }
  }
  return null
}
