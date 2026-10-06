# Spike results: gsd-whisper (2026-10-06)

Environment: Claude Code 2.1.291, WSL2 Linux, interactive CLI session with mod
hot reload enabled. gsd-core hooks installed through `~/.claude/settings.json`
(command hooks), not as a plugin. Mod: `mods/gsd-whisper` v0.1.x.

## S1: can a mod read gsd-core's hook output? CONFIRMED (settings.json install)

- Trigger: a Write to a path under `.planning/` with `hooks.community: true`
  set in the session folder's `.planning/config.json` (gsd-phase-boundary.sh is
  opt-in; the config was temporary and removed after).
- Signal 1: the mod's `classic.PostToolUse` hook, after `await next(e)`,
  received `additionalContext` containing gsd-phase-boundary's text and
  classified it (`[advice] phase-boundary Write`).
- Signal 2: the engine independently showed the agent the same text as
  "PostToolUse:Write hook additional context: .planning/ file modified: ...".
- Not checked: gsd-core installed as a Claude Code plugin (its command hooks in
  the plugin's `hooks.json`). The types say the chain is
  `[managed settings hooks, ...hooks modules, the other settings hooks]`;
  whether plugin command hooks sit in "the other settings hooks" is open.

## S2: does a gsd-core deny reach the mod? CONFIRMED, with a prefix

- Trigger: Read of a dummy `.env` in a scratch folder. gsd-secret-read-guard
  denied it.
- The mod's `classic.PreToolUse` hook received `{ deny }`, but the text the
  engine hands over is prefixed: `PreToolUse:Read hook error: Secret read
  guard: ...`. The classifier now strips `<Event>[:<Tool>] hook [blocking ]error: `
  before matching. Before that fix the deny was filed as "not gsd-core".

## Findings that change the design

1. **Two gsd-core advisories never fire on Claude Code.**
   `gsd-read-guard.js` skips its read-before-edit advice when it detects
   Claude Code (line ~140, #1984/#2344/#2520: the runtime enforces it). The
   rule stays in the classifier for other paths but should not be advertised as
   something users will see on Claude Code.
2. **Several gsd-core hooks are opt-in** (`hooks.community: true`:
   phase-boundary, session-state, validate-commit; `hooks.workflow_guard`:
   workflow guard). On a default project the visible set is smaller: context
   monitor, the deny guards (secret read, write, worktree path, agent
   isolation), prompt/read injection scanners, config reload.
3. **Hook text has no per-hook attribution** (`additionalContext: string[]`,
   merged), so recognition by message text is the only option. Other hooks on
   the machine (praxis, local handover hooks) also inject text; the mod counts
   them and stays silent.
4. **Absolute paths make lines unreadable**; summaries now keep the last two
   path segments.
5. **`$.ui.notice` is not a persistent row note** (it lives under an open
   permission dialog only), so lines use `$.ui.log`.
6. **The live loader matched `claude plugin validate`** for this module once
   event names and state refs were literals; no validate-passes/loader-refuses
   gap was hit (the gap gsd-status-mod reported was about passing `$` to a
   const arrow function; this mod passes `$` only to function declarations).

## Round 2 (v0.2.0, UI)

- **Plugin command hooks are visible too.** The mod recorded a `classic.Stop`
  block from a command hook shipped inside another plugin
  (`${CLAUDE_PLUGIN_ROOT}/scripts/stop-evidence.mjs`), and PreToolUse advice
  from settings hooks. This is strong evidence for the open half of S1
  (gsd-core installed as a plugin), not a test of gsd-core itself.
- **FileChanged carries no additionalContext in the 2.1.291 types.**
  `ClassicResultFields` lists no `additionalContext` for `FileChanged`, so
  gsd-core's `gsd-config-reload.js` (which answers FileChanged with
  `additionalContext`) may never reach the agent on this Claude Code version.
  Source: the types only; not observed live. Worth a live check before any
  upstream report.
- `$.ui.log` lines were replaced by a badge under the tool row, drawn by
  wrapping the engine's own `ToolUse` / `ToolGroup` drawing
  (`<Box>{await next(e)}...</Box>`), with per-call state in a `StateFamily`
  keyed by `tool_use_id` (written through `memberOf(byCall, { requestId })`),
  so a new message redraws only its own row.

## Found while building gsd-pilot

- **`$` is not followed across an import.** `claude plugin validate` refused a
  module that passed `$` to a function imported from another file of the
  plugin: "$ is followed only into a function declared in this same file".
  Anything that takes `$` lives in the hooks module itself; pure helpers can be
  imported.
- **`smart-entry` answers in the retired colon form.** `gsd-tools smart-entry
  --json` returned `"/gsd:progress --next"`, `"/gsd:execute-phase"` (gsd-core
  1.16.0 installed copy, 2026-10-06), while gsd-core's own
  `src/runtime-slash.cts` says the colon form "is no longer" used and Claude
  takes `/gsd-<cmd>`, and this install registers only `gsd-*` skills. Possibly
  an upstream gap (smart-entry not routing through `formatGsdSlash`); not
  checked against `next` source line by line, nothing filed.

## Not yet checked

- S3: how the badge, pane and CRITICAL band look on screen, and
  next to gsd-status-mod (needs the person's eyes; the agent cannot see the
  screen).
- The context-monitor path end to end (needs a session near its threshold).
- Plugin-install gsd-core (S1 second half).
