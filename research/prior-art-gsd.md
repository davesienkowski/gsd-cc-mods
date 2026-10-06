# Prior art inside the GSD ecosystem

## gsd-core #5174 - in-tree mod adapter (declined)

- Proposed 2026-10-02: an optional mod inside the gsd-core plugin drawing a
  phase/plan band, later moving the context monitor and guards into the module.
- Closed NOT_PLANNED the same day. Recorded in
  `.out-of-scope/claude-code-mod-adapter-in-core.md` (merged via #5175):
  the interface is too new; no new in-tree runtimes or add-ons
  (`kiro-runtime-in-core.md`); a new statusline data source is a feature
  (ADR-2164). Revisit on or after 2026-11-01.
- The record states it does NOT cover a standalone mods plugin or an
  out-of-tree host plugin. That is the lane this repo works in.

## helenkwok/gsd-status-mod (standalone, MIT)

https://github.com/helenkwok/gsd-status-mod - the existing GSD mod. Read-only.
Listed in awesome-claude-code-mods. It already ships:

- `GSD ·` band above the prompt: `stopped_at`, phases done, and a
  "~N commits since STATE.md" drift warning (from `state_head` and the reflog).
- `next:` hint from `.planning/HANDOFF.json` and a Tab prompt suggestion for
  the next command.
- `/gsd-status` resume report and `/gsd-board` live pane: context gauge, cost,
  5h/7d limits, roadmap with current phase, pace (waves, parallelism, typical
  executor time from a per-project history in `$.store`, quota fit), agent tree
  with forks and live clocks, trends, timeline, work-stream counts, session log,
  and a `.planning` markdown reader with contents and safe-link following.
- Toasts: agent over 2x typical, phase tight against the 5h window, STATE.md
  drift.
- Workstream mode and worktree-to-main-checkout resolution.

Implication: a "GSD dashboard" mod is taken, and done well. New mods here
should either compose with it (not redraw the same band) or cover ground it
deliberately leaves out: it is read-only, so it writes nothing, runs no
processes, guards nothing, and asks the model nothing.

## gsd-core's own Claude Code hooks (command hooks, not mods)

`hooks/` ships: statusline, context monitor (WARNING <= 35% remaining,
CRITICAL <= 25%, via a `/tmp/claude-ctx-<session>.json` bridge file), prompt
guard, read guard (advisory read-before-edit), read-injection scanner, secret
read guard, write guard (blocks sharp shrink of ROADMAP/STATE), workflow guard
(advisory on edits outside a GSD workflow), worktree path guard, agent
isolation guard, phase-boundary reminder, commit-message validator, session
state (opt-in), update check/banner, graphify update.

Open statusline issues relevant to mods: #4914 (per-render Node cold start
~300ms), #5048 (git index.lock on render), #4985 / #4844 (context meter vs the
real auto-compact point), #4840 (context-monitor cross-host contract).
