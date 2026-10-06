# gsd-core: invisible state and friction a mod could address

Read-only map of gsd-core `next` (2026-10-06, base 13d37238b). Shape:
moment/state -> where in code -> what a mod could show or enforce.
Line citations sampled and re-checked against source: ui-brand.md:49,
execute-phase.md:578, gsd-executor.md:520, gsd-context-monitor.js:13-18,
gsd-statusline.js:863, plan-phase.md:732 (6/6 confirmed). Other locators are
unsampled leads.

## 1. Prose UI the model is told to print

- Stage banners `GSD > {STAGE NAME}` -> `gsd-core/references/ui-brand.md:49`
  (and an anti-pattern list for skipping the prefix) -> a stage band set by a
  hook, which cannot be skipped or misformatted.
- "Next Up" routing blocks repeated in ~10 workflows (execute-phase, progress,
  new-milestone, complete-milestone, map-codebase, audit-milestone, add-phase,
  add-tests, discuss-phase-assumptions, insert-phase) -> a persistent
  next-command chip / prompt suggestion.
- Checkpoint panels ("CHECKPOINT: Verification Required", "Decision
  Required") -> `ui-brand.md:65-81`, `execute-plan.md` human-verify returns ->
  real Approve / Describe-issue buttons and a pending-checkpoint indicator.
- AskUserQuestion-heavy workflows (47 of 89 top-level workflow files mention it,
  60 counting nested files; mentions: new-project 18,
  settings-advanced 15, new-milestone 13) -> a decision-log pane per run.
- execute-phase interactive menu (execute / review-first / skip / stop) ->
  buttons.

## 2. Long waits with no visibility

- Researcher / pattern-mapper / planner dispatch: "runs in a subagent - no
  output until it returns, ~1-5 min; expected, not a freeze"
  (`plan-phase.md`, `execute-phase.md:578`) -> live per-subagent view:
  elapsed vs expected, last tool call, files touched.
- Wave-parallel executors (background `Agent()` per plan) -> a wave board:
  wave N of M, plan, status, worktree, commits so far, SUMMARY.md landed.
- Stall detection (`gsd_stall_watch` / `gsd_stall_should_recover`,
  `plan-phase.md:732`) is internal to the model -> surface stall state.
- Per-subagent context files `/tmp/claude-ctx-{session}-agent-*.json` are
  already scanned by the statusline -> per-agent context in a wave view.

## 3. Rules enforced only by prose (tool.call guard candidates)

- "Stage task-related files individually (NEVER `git add .` or `git add -A`)"
  -> `agents/gsd-executor.md:520`.
- "Do NOT use `--no-verify` by default" -> `execute-plan.md`.
- Generated-file ownership: `src/*.cts` compiles to `gsd-core/bin/lib/*.cjs`
  (CONTRIBUTING.md); nothing stops an edit to the generated copy. (Applies to
  contributors to gsd-core itself, not to GSD users.)
- Changeset fragment required for PRs touching shipped dirs (CONTRIBUTING.md)
  -> pre-push reminder. (gsd-core contributors only.)
- Executor must write SUMMARY.md and update STATE.md -> SubagentStop check.

Existing command hooks already enforce some rules: write guard (sharp shrink
of ROADMAP/STATE), commit-message validator, worktree path guard, agent
isolation guard. Several are advisory only (read guard, workflow guard,
phase-boundary reminder): they inject text to the model, and the user never
sees them.

## 4. Known pain points

- Context exhaustion: the monitor tells only the agent (WARNING <= 35%
  remaining, CRITICAL <= 25%); on CRITICAL it writes "Stopped At: context
  exhaustion" into STATE.md.
- Verification staleness / loops (stale fingerprints,
  `verification_status_invalid`, health W030).
- Codebase-map drift (`workflow.drift_threshold`).
- Stale installed GSD vs source (stale-bake warning).
- Phase too large for the context budget ("PHASE SPLIT RECOMMENDED").
- Lost handoffs: the session-state hook is opt-in (`hooks.community: true`).

## 5. Metrics computed but only printed as text

Context % (bridge file), progress % / bars (`progress.md`, `stats.md`),
health codes (W0xx), `last_gate_trip` in STATE.md. No cost or token-spend
tracking was found in workflows or hooks via the paths searched.
