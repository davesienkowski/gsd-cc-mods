# Lens 2: adversarial, prompted-to-refute pass

An independent reviewer was asked to kill every catalog entry (attack angles:
duplication, API mismatch, prose parsing, model-visible change, guard
misfire, cost, data-source failure, value). Its load-bearing claims were then
re-checked against source by the author; the "Re-check" column says which.
T = the 2.1.291 `claude-code.d.ts`; GC = gsd-core `next` @ 13d37238b.

## Key finding: a mod sits above gsd-core's hooks

T:1194: "The chain is [managed settings hooks, ...hooks modules, the other
settings hooks as core]". T:1245: a classic result carries
`additionalContext?: string[]`, "one entry per hook: text handed to the model
with the event". So a mod calling `next(e)` on a `classic.*` event sees what
gsd-core's command hooks told the model. **Re-checked: confirmed in the types.**
Not yet observed in a live session; also unconfirmed whether command hooks
shipped inside a plugin's `hooks.json` (gsd-core's plugin install) count as
"other settings hooks" here. That is spike S1 in the shortlist.

## Verdicts

| ID | Verdict | Strongest refutation | Re-check |
|---|---|---|---|
| A1 | RESHAPE | Banner is model prose; gsd-core's statusline already shows GSD state | Skill name from `skill.prompt` is reliable; stage only when a banner was seen this turn |
| A2 | RESHAPE | Checkpoint cards from prose go stale silently; TEXT_MODE varies wording | TEXT_MODE: 69 references in top-level workflows (reviewer said 84) |
| A3 | SURVIVES (narrow) | TEXT_MODE answers bypass AskUserQuestion | State the coverage gap in the UI |
| A4 | RESHAPE | Process per `.planning` edit; gsd-status-mod already owns the line under those rows | Diff frontmatter in memory, no spawn |
| A5 | KILL | Live per-must-have status does not exist until VERIFICATION.md is written | Accepted |
| A6 | RESHAPE | `verification status` errors without a phase dir (measured) | Resolve the phase via `planning inspect` |
| A7 | SURVIVES (strongest) | None; mechanism in the types | Confirmed T:1194, T:1245 |
| A8 | RESHAPE | `state-snapshot.current_phase` was null on a live project | Attribute by running skill; offer upstream to gsd-status-mod |
| A9 | KILL (fold into B5) | Decoration; legal moves already in `smart-entry actions[]` | Accepted |
| A10 | KILL | Hover is fullscreen/desktop only, static text | Accepted |
| B1 | KILL | Engine replaces suggestions after each turn (gsd-status-mod README) | Accepted; a palette (B5) is the durable surface |
| B2 | SURVIVES | Capture verb taking text is unverified | Fill `/gsd-capture`, write nothing directly |
| B3 | RESHAPE | `prompt.mention` fires per file "as the engine resolved it" (T:8465) | Confirmed; becomes `/gsd-attach phase 3` |
| B4 | KILL | Model call per prompt; duplicates in-model routing | Accepted (also cut by lens 1) |
| B5 | SURVIVES | Must split stderr (config warning) from stdout | Absorbs A9 |
| B6 | RESHAPE | UAT turn protocol unread | Read-only checklist until spiked |
| B7 | KILL | High overlap with gsd-status-mod | Accepted |
| C1 | RESHAPE | `--no-verify` is legal under `workflow.worktree_skip_hooks` (execute-plan.md:311-314); `git add -A` is prescribed on a scratch WIP branch (gsd-executor.md:623) | Confirmed both; warn by default, honor the opt-out and the scratch case |
| C2 | RESHAPE | Executors legitimately touch undeclared files | Warn only; one end-of-plan diff of undeclared files |
| C3 | SURVIVES | File-backed | Use `phase-plan-index` `has_summary` |
| C4 | RESHAPE | Gauge exists twice already | Merge into A7 + a Pause button |
| C5 | RESHAPE | Fires for `precompute`/`plugin` triggers and subagent compactions | Act only on `auto`/`manual` with no `agentId`; needs an eval |
| D1 | KILL | Rewrites workflow text gsd-core's gates assume | Accepted; upstream proposal instead (lens 1) |
| D2 | RESHAPE | Duplicates STATE.md; cache cost | Opt-in; invalidate on plan-id change only |
| D3 | KILL | Blind reminder removal | Accepted |
| E1 | RESHAPE | Guesswork answer | On-demand fallback only |
| E2 | RESHAPE | Depends on reliable checkpoint detection | Only for tool-originated cards |
| E3 | KILL | Duplicates gsd-plan-checker | Accepted (also cut by lens 1) |
| F1 | SURVIVES | None material | Trigger on AskUserQuestion / permission prompt / idle-with-no-agents, not prose |
| F2 | RESHAPE | Amber clock exists in gsd-status-mod; stall watch is upstream #5182 | Show only the stalled agent's last tool call |
| F3 | RESHAPE | Writing `.planning/runs/` dirties git | `$.store`, export on demand |
| G1 | SURVIVES | A few `.cjs` have no twin | Warn and name the twin |
| G2 | RESHAPE | Changeset rule has per-directory nuance | Warn only |
| G3 | SURVIVES | Read-only, cheap | |
| G4 | RESHAPE | mtime false positives after checkout | Hash or manifest |
| I1 | RESHAPE | Heartbeats are prose the model "MUST" print | Board from `phase-plan-index` + SUMMARY files; heartbeats as hints |
| I2 | SURVIVES | Rationale table is hand-maintained | Small table, fallback to raw deny text |
| I3 | RESHAPE | Overlaps E1 | Answer over CONTEXT.md decisions only, cite D-IDs |
| I4 | RESHAPE | SUMMARY has only a "Task Commits" heading, no range | Use `select-revert-commits --plan`; merge into I8 |
| I5 | KILL | No measured data | Accepted |
| I6 | SURVIVES | `validate consistency` returns `{passed, errors, warnings}` | Run only when a `.planning` file changed this turn |
| I7 | RESHAPE | Overlaps A1 and the agent tree | Fold into A1 |
| I8 | SURVIVES | Fills `/gsd-undo`, never reverts itself | Absorbs I4 |
| H1 | RESHAPE | Cross-process `session.send` reach unverified | Wait for gsd-core #4845 |

Tally (counted from this table, 44 rows): 10 kill, 23 reshape, 11 survive.
The reviewer's own summary said 6/26/9 over 41; its table and the re-check
moved the line (A9, B4, B7, I5 counted as kills here; G1, G3, I6, I8 as
survives).

## Gaps the attack surfaced (now ground rules)

1. **Coexistence.** Two mods hooking one site depend on install order; with
   gsd-status-mod installed, the band above the prompt is crowded. Rule: these
   mods do not draw `AbovePrompt` by default.
2. **TEXT_MODE.** Every idea using the typed AskUserQuestion needs a declared
   text fallback or a stated coverage gap.
3. **stderr.** Every gsd-tools call reads stdout only, with `--json-errors`.
4. **Null phase.** One shared, null-safe resolver for the active phase
   (`planning inspect` `active.phase`, then hide).
5. **Subagent events.** `session.compact`, `turn.complete` and `tool.call` fire
   in subagent loops (`agentId`); every hook states whether it acts there.
