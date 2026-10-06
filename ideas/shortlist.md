# Shortlist: what to build, in what order

Built from the catalog after lens 1 (artificer laws), lens 2 (adversarial,
re-checked), lens 3 (edge and prohibition probes) and lens 4 (quantifiers).
Every mod obeys the lens 3 prohibitions P1-P12 and answers edge probes
EP1-EP16.

## The open space

gsd-status-mod already shows GSD's state well and, per its README, is
read-only: no processes, no model, no guards. gsd-core's statusline shows state
too. What neither of them draws, in the sources read for this study:

1. **What GSD tells the agent that the person never sees** (the context
   monitor's warnings, read/workflow-guard advice, guard denials). Per the
   types, a mod sits above settings hooks in the chain and can read that text
   after `next`; whether that holds for gsd-core's plugin-install hooks is
   spike S1.
2. **The move after the state**: one key to the legal next command, capture,
   undo, attach.
3. **Unattended runs**: telling a person who walked away that the run needs
   them, and catching a plan that ended without its SUMMARY.
4. **Rules GSD states only in prose**, as opt-in warnings.

## Proposed mods

Five user mods plus one contributor mod, so each can be installed alone.
Names are working names.

### 1. `gsd-whisper` (build first)
Shows the person what gsd-core's hooks told the agent.
- A7 + C4: a dim line under the tool row, `GSD told the agent: context 30% left, wrap up`,
  and at CRITICAL a toast with a `Pause` button that fills `/gsd-pause-work`.
- I2: when a gsd-core guard denies a call, a line naming the rule and its fix
  (small rule table, raw deny text as fallback).
- Why first (Gall): smallest surface, no gsd-tools call, no writes, no
  guards, and it exercises the one mechanism the whole pack leans on
  (mods above classic hooks). If spike S1 fails, the pack's premise changes
  before anything larger is built.
- Events: `classic.PostToolUse`, `classic.PreToolUse`, `classic.Stop`
  (observe after `next`), `ui.render` ToolResult or `$.ui.log`, `$.ui.toast`,
  `$.prompt.fill`.

### 2. `gsd-pilot`
The action layer.
- B5 (+A9): `/gsd` palette pane of legal next commands from
  `smart-entry --json actions[]`, grouped; each a button that fills the prompt.
- A6: verification chip for the active phase (`planning inspect` ->
  `verification status <dir>`), with the route command as a palette entry.
- I6: consistency light from `validate consistency`, run only on turns that
  changed a `.planning` file.
- B2: `/gsd-grab`: the mouse selection into `/gsd-capture` (todo / seed /
  note), filled, not run.
- B3 reshaped: `/gsd-attach phase 3 | plan 03-02 | req AUTH-01` attaches the
  right `.planning` files.
- I8 (+I4): `/gsd-undo` as a pane: pick phase or plan, see commits from
  `select-revert-commits`, view diffs, then fill the undo command.
- Introduces the shared `gsd()` adapter (installed gsd-tools only,
  `--project-dir`, `--ws`, stdout only, `@file:` follow, timeout, per-turn
  cache, null-safe active phase).

### 3. `gsd-nightwatch`
For `/gsd-autonomous` and long execute waves.
- F1: sound + toast when the run needs a person: an AskUserQuestion call, a
  permission prompt (`classic.PermissionRequest` / `classic.Notification`,
  both in the types), or a turn that ends with no agent running. An OS-level
  notification has no `$` noun; whether to shell out for one is spike S7.
- C3: when an executor loop completes without its plan's SUMMARY (via
  `phase-plan-index` `has_summary`), a toast and a notice row.
- F2 reshaped: for a long-quiet agent, its last tool call (not another clock).
- F3 reshaped: a run journal in `$.store`, `/gsd-night` shows it, export on
  press.
- I1 reshaped: a wave board from `phase-plan-index` + SUMMARY files, with
  heartbeat lines as a hint only.

### 4. `gsd-hygiene` (opt-in rules)
Every rule `off | warn | deny`, default `warn`; no rule language.
- C1: in executor loops, `git add -A`/`.` (except on a `scratch-*` branch) and
  `git commit --no-verify` (except when `workflow.worktree_skip_hooks` is set).
- C2: end-of-plan card listing files touched but not in `files_modified`;
  silent when a plan declares none.
- `deny` also works in the VS Code chat panel and cloud sessions, where hooks
  run but nothing draws; `warn` there has no card to show, so it only logs.

### 5. `gsd-ledger`
- A3: decision ledger of AskUserQuestion answers per workflow run, with the
  TEXT_MODE gap stated; export to a notes file on press.
- A8 reshaped: time and tokens attributed by running GSD skill
  (`skill.prompt`), shown as information, never as a budget.
- I3: `/gsd-ask` over CONTEXT.md decisions, citing D-IDs.

### 6. `gsd-core-contrib` (maintainers only, separate plugin)
- G1: warn on edits to `bin/lib/X.cjs` when `src/X.cts` exists, naming it.
- G3: ADR lens for the open `src/*.cts` (its `ADR-` citations with titles).
- G4: stale-build chip by content hash, not mtime.
- G2: changeset reminder before push (warn only).

## Spikes before building (each a live-session check)

| ID | Question | Blocks |
|---|---|---|
| S1 | Does a mod's `next(e)` on `classic.PostToolUse` return gsd-core's `additionalContext` for a settings.json install AND for a plugin install? **Settings.json: CONFIRMED 2026-10-06** (research/spike-results-gsd-whisper.md); plugin install: open | gsd-whisper |
| S2 | Does a classic PreToolUse deny from gsd-core reach a mod with its reason text? **CONFIRMED 2026-10-06**, text arrives prefixed `PreToolUse:<Tool> hook error: ` | gsd-whisper I2 |
| S3 | Can a `ToolResult` render hook add one dim line without replacing the engine's row, alongside gsd-status-mod's own added line? | gsd-whisper, coexistence |
| S4 | `$.agent.list()` gives the agent type for a `tool.call` `agentId` inside a GSD executor? | gsd-hygiene C1, nightwatch C3 |
| S5 | Which `/gsd-capture` form accepts quoted text cleanly via `$.prompt.fill`? | gsd-pilot B2 |
| S7 | OS notification for F1: is a host command (`notify-send`, `osascript`, a Windows toast) worth an opt-in `$.process.run`, given mods are not sandboxed? | gsd-nightwatch F1 (sound + toast work without it) |
| S6 | Cost of `planning inspect` + `smart-entry --json` per turn on a large project | gsd-pilot |

## Upstream proposals (gsd-core issues, not mods)

Drafts only; nothing is filed without review.

1. **Call `state signal-waiting` at checkpoints.** gsd-core has the writer
   (`.planning/WAITING.json`, read back by `init` as `waiting_signal`) but no
   workflow calls it. With it, a checkpoint inbox (A2) needs no prose parsing.
2. **A structured stage signal**, so "which workflow step is running" is data,
   not a `GSD >` banner (A1).
3. **Revisit the in-tree mod question after 2026-11-01** with field data from
   these mods, per the re-open criteria in
   `.out-of-scope/claude-code-mod-adapter-in-core.md`.

## Cut, and why

A5, A10, B1, B4, B7, D1, D3, E3, I5, A9 (folded into B5), I7 (folded into
A1); A1/A2/E1/E2 parked behind upstream proposal 1-2; C5 and D2 parked until
an eval shows they help; H1 parked behind gsd-core #4845. Reasons in
lens-1-artificer.md and lens-2-adversarial.md.
