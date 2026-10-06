# GSD mod idea catalog (v1, pre-review)

Status: raw catalog. The artificer, adversarial, probe and quantifier passes
live in sibling files and may cut or reshape any entry here. Do not read an
entry as a recommendation until `shortlist.md` names it.

## Ground rules this catalog was written under

1. **Out of tree.** gsd-core declined an in-tree mod (#5174, revisit on or after
   2026-11-01). Everything here ships as a standalone plugin.
2. **Compose with gsd-status-mod, do not redraw it.** helenkwok/gsd-status-mod
   already ships: a `GSD ·` band (stopped_at, phases done, STATE.md drift), a
   `next:` hint and a session-start Tab suggestion from HANDOFF.json,
   `/gsd-status`, and a `/gsd-board` live pane (context, cost, limits, roadmap,
   pace and quota fit, agent tree with typical times, trends, timeline, work
   streams, `.planning` markdown reader). It is read-only: it writes no files,
   runs no processes, guards nothing and asks the model nothing. That last
   sentence is the open space.
3. **Observe or deny, never rewrite tool input.** A mod's `tool.call` hook runs
   before classic PreToolUse hooks, so a rewrite changes what gsd-core's own
   guards see (#5174 field report).
4. **Prefer gsd-tools verbs to markdown parsing.** `gsd-tools` answers
   `state-snapshot`, `progress json`, `smart-entry`, `audit-open`, `roadmap`,
   `phase`, `verification`, `list-todos`, `list-seeds` and more, in 0.15-0.27 s
   per call on a real project (measured 2026-10-06). Calling the CLI once per
   turn (never per render) keeps the mod off GSD's file formats, which is the
   main maintenance cost gsd-status-mod reports.

5. **One feed, not ten parsers.** `gsd-tools planning inspect` returns one
   schema-versioned JSON snapshot of `.planning/` (milestone, active
   phase/plan/status, per-phase verification and next action), documented as
   the feed for "a harness UI, a mission-control view, a dashboard". Pass
   `--project-dir` (from a linked worktree the CLI otherwise resolves the main
   checkout) and keep stderr apart from stdout (a config warning prints there).
   `smart-entry --json` gives `situation`, `recommended`, `signals`, `actions[]`.
6. **Two kinds of surface.** Hooks run in the CLI, the Desktop Code tab, the
   VS Code chat panel and cloud sessions; drawing happens only in the CLI and
   Desktop. Guard and prompt-shaping ideas reach every surface where mods
   load; pane and band ideas reach two. Desktop WSL sessions load no plugins.
7. **Transcript markers that already exist.** execute-phase prints
   `[checkpoint] phase X wave N/M plan P {starting|complete|failed|checkpoint}
   (P/Q plans done)` (execute-phase.md:511-517). Checkpoint boxes end in
   `**-> YOUR ACTION: ...**` (references/checkpoints.md). These are the parse
   anchors for the wave and checkpoint ideas. `.planning/WAITING.json` has a
   writer (`state signal-waiting`) but no workflow calls it (searched workflows,
   agents, commands), so no idea may depend on it.

## Legend

- **Events**: the mod events or `$` calls used (from the 2.1.291 types).
- **Data**: where the facts come from.
- **Overlap**: what gsd-status-mod already does here. "None found" means none in
  gsd-status-mod's README or gsd-core's hooks as read; lens 2 found overlaps
  this catalog missed (A4, A9, B1, C4) and those corrections stand.
- **Risk**: `api` (leans on an event with no field history), `model` (changes
  what the model reads), `write` (writes files or runs commands), `guard`
  (refuses something).
- **Grounding**: `admit` (the types document every event used), `spike` (a
  load-bearing behavior is unverified), `abstain` (depends on a fact not checked).

---

## Lane A. See: state GSD has that no surface read here draws

**A1. Active-workflow band ("where am I in the GSD loop")**
A one-line band: `plan-phase 3 > research > plan-checker pass 2/3`. Knows which
`/gsd-*` workflow is expanding because `skill.prompt` fires per skill expansion;
step position comes from the stage banners (`GSD > STAGE`) the workflow already
prints (ui-brand.md:49), read from `turn.step` / AssistantMessage text.
Events: `skill.prompt` (observe only), `session.append` (observe), `ui.render`
AbovePrompt. Data: skill name, banner text. Overlap: none found (gsd-status-mod
cannot see the running workflow). Risk: api. Grounding: admit for the skill
name; spike for banner parsing reliability.

**A2. Checkpoint inbox**
When a workflow returns a checkpoint (`checkpoint:human-verify`, decision
required, the execute-phase execute/review/skip/stop menu), show a pinned
card above the prompt with real buttons: Approve, Describe issue, Skip. A
pending-checkpoint marker stays in the status line until answered, so a
checkpoint that scrolled away is not lost. Buttons call `$.prompt.fill` (never
auto-submit). Events: `session.append` (observe assistant text for the
checkpoint markers in ui-brand.md:65-81), `ui.render` AbovePrompt,
`$.ui.status`, `$.prompt.fill`. Data: transcript text. Overlap: none found. Risk:
api. Grounding: spike (marker text stability across workflows).

**A3. Decision ledger**
Each AskUserQuestion answer during a GSD workflow (60 workflow files mention
it, counting nested files; new-project mentions it 18 times; TEXT_MODE paths
bypass the tool and are not captured) is recorded with the question, the chosen
option, the workflow and the phase. A pane lists them per run, so "what did I
pick in question 7 of new-project?" has an answer without scrolling. Export
button writes a `DECISIONS-<date>.md` under `.planning/notes/` (opt-in write).
Events: `tool.call` on AskUserQuestion (await `next`, read answer),
`ui.render` Pane, `$.store`. Overlap: none found. Risk: api; write (export only).
Grounding: admit (AskUserQuestion is a built-in tool with a typed input).

**A4. Semantic diff under .planning edits**
When the model edits STATE.md, ROADMAP.md, REQUIREMENTS.md or a PLAN.md, draw
a line under the ToolUse row that says what changed in GSD terms:
`phase 3: planned -> executing`, `REQ AUTH-02 checked`, `must_haves +1`.
Computed by calling `gsd-tools state-snapshot` / `roadmap` before and after.
Events: `tool.call` (Edit/Write/MultiEdit on `.planning/**`, observe),
`ui.render` ToolUse/ToolResult, `$.process.run`. Overlap: none found. Risk: api.
Grounding: admit for hooks; spike for ToolUse row rendering of an added line
(gsd-status-mod already adds an "open in reader" line under such rows, which
shows the site takes one).

**A5. Must-haves tracker during execute and verify**
During execute-phase / verify-work, a pane lists the current plan's
`must_haves` (truths, artifacts, key links from PLAN.md frontmatter) and ticks
each as the verifier reports it. Answers "is this plan actually done?" at a
glance. Events: `ui.render` Pane, `turn.complete`. Data: `gsd-tools frontmatter`
or `phase-plan-index`; VERIFICATION.md. Overlap: none found. Risk: api. Grounding:
abstain (the verify output format per must-have was not checked).

**A6. Health and verification chip**
A compact chip: `verify: stale` / `gaps_found` / `human_needed` / `passed`, and
`health: W030` when `/gsd-health` codes fire, each with the command that fixes
it as a Tab suggestion. Data: `gsd-tools verification status <phase-dir>`,
`validate`. Overlap: none found (gsd-status-mod shows drift, not verification).
Risk: api. Grounding: spike (needs the phase dir resolved; the bare verb
errors without it, measured).

**A7. Hidden-advisory echo**
gsd-core's advisory hooks (read guard, workflow guard, phase-boundary
reminder, context monitor) inject text that only the model sees. This mod
shows the person a dim line when one fired: `GSD advised: read before edit`,
`GSD: context at 30% left, agent told to wrap up`. The person then knows why
the model changed course. Events: `classic.PostToolUse` / `classic.PreToolUse`
observed for `additionalContext`, `ui.render` ToolResult or `$.ui.log`.
Overlap: none found. Risk: api. Grounding: spike (whether a mod can read a classic
hook's `additionalContext` output is unverified).

**A8. Per-phase cost and time ledger**
`/gsd-cost` shows tokens, dollars (as Claude Code reports them) and wall time
per phase and per milestone, attributed by the active phase at each turn.
No cost tracking was found in gsd-core's workflows or hooks. Events:
`turn.complete` (usage), `$.session.usage`, `$.store`. Data:
`state-snapshot.current_phase`. Overlap: partial (gsd-status-mod keeps
per-agent token counts and agent time by phase, not a per-phase cost roll-up).
Risk: api. Grounding: admit.

**A9. Workflow map**
A pane drawing the GSD loop (discuss -> plan -> execute -> verify -> ship, plus
quick/debug/spike side doors) with the current position lit and the legal next
moves as buttons. Svg on desktop, text boxes on terminal. Aimed at newcomers.
Events: `ui.render` Pane, `$.prompt.fill`. Data: `smart-entry`,
`progress json`. Overlap: partial (roadmap list). Risk: api. Grounding: admit.

**A10. Artifact hover cards**
Hovering a `.planning/...` path in a ToolUse row shows what the artifact is
(`PLAN.md: an executable plan, one per wave slot`) and its key frontmatter.
Events: `ui.render` ToolUse with a keyed Box `hover` style. Overlap: none found.
Risk: api. Grounding: spike (hover is fullscreen-terminal and desktop only).

## Lane B. Act: one keystroke to the right GSD move

**B1. Next-move suggestion after every turn**
After each turn, propose the authoritative next command as the prompt box's
Tab suggestion, from `gsd-tools smart-entry` (which already answers
`Recommended: progress-next -> /gsd:progress --next`). gsd-status-mod does this
once at session start from HANDOFF.json; the engine's own suggestion replaces
it after. This one answers every turn, from the CLI's routing rather than a
handoff file. Events: `turn.complete`, `$.prompt.suggest`, `prompt.suggest`.
Overlap: partial. Risk: api. Grounding: admit.

**B2. Capture selection to GSD**
Select text in the transcript, run `/gsd-grab` (or press a band button), pick
todo / seed / note; the mod calls the matching `gsd-tools` capture verb (or
fills `/gsd-capture --seed ...`) with the selection quoted. Turns "I should
remember that" into an artifact in two keys. Events: `$.ui.selection`,
`$.command.register`, `command.run`, `$.process.run` or `$.prompt.fill`.
Overlap: none found. Risk: write. Grounding: admit for selection; spike for which
capture verb takes stdin text.

**B3. `@` mentions for GSD entities**
`@phase:3`, `@plan:03-02`, `@req:AUTH-01`, `@seed:SEED-012` resolve to the
right file(s) and attach them. Events: `prompt.mention` with
`next({ ...e, path })` redirection. Overlap: none found. Risk: api. Grounding: spike
(the doc says the hook fires per `@path` before the read and can redirect, but
whether it fires for a name that is not an existing path is unverified).

**B4. Freeform-intent router**
When the person types plain intent ("the login test is flaky"), classify it
against GSD's routing table (debug / quick / explore / spike / capture) and
show the matching command as a Tab suggestion; never rewrite the prompt.
Events: `prompt.submit` (observe), `$.model.classify` or `$.model.complete`,
`$.prompt.suggest`. Overlap: none found (gsd-core has a `/gsd-do`-style dispatcher
inside the model; this is out-of-band). Risk: api; spends a small model call
per prompt (make it opt-in). Grounding: abstain (classify cost/latency not
measured).

**B5. Command palette pane**
`/gsd` opens a pane of the commands that are legal now (from `smart-entry`
and `progress json`), grouped (continue / capture / inspect / repair), each a
button that fills the prompt. Events: `$.command.register`, `ui.render` Pane,
`$.prompt.fill`. Overlap: none found. Risk: api. Grounding: admit.

**B6. UAT runner**
`/gsd-verify-work`'s conversational UAT drawn as a checklist: each test case a
row with Pass / Fail / Note buttons; a press fills the answer the workflow is
waiting for. Events: `ui.render` Pane or AskUserQuestion site,
`$.prompt.fill`. Data: UAT.md. Overlap: none found. Risk: api. Grounding: abstain
(UAT turn protocol not read).

**B7. Resume card on session start**
At session start in a GSD project with a HANDOFF or paused STATE, a card:
`Paused 2d ago at plan 03-02: <stopped_at>` with buttons Resume
(`/gsd-resume-work`), Show handoff, Dismiss. Overlap: high (gsd-status-mod's
band + hint + Tab suggestion cover most of it). Kept only as a composition
note: if built, it replaces nothing of theirs. Risk: api. Grounding: admit.

## Lane C. Guard: rules GSD states in prose, enforced deterministically

All guards: opt-in per rule, `warn` mode by default (toast + allow), `deny`
mode available; written with `.catch` so a failing guard fails the way the
config says; observe-or-deny only.

**C1. Executor git hygiene**
Inside a `gsd-executor` subagent loop (`e.agentId` -> `$.agent.list()` type),
deny `git add -A` / `git add .` (gsd-executor.md:520) and `git commit
--no-verify` (execute-plan.md). Events: `tool.call` Bash, `$.agent.list`.
Overlap: none found. Risk: guard; api. Grounding: admit for agentId on tool.call
(types: `AgentLoop.agentId`); spike for reading the agent type from the id at
call time.

**C2. Plan scope fence**
During execute of plan N, an Edit/Write outside that plan's `files_modified`
(PLAN.md frontmatter) raises a warning card: `03-02 did not declare
src/auth.ts`, with Allow once / Add to plan / Deny. Keeps executors inside the
plan's declared footprint. Events: `tool.call` Edit/Write/MultiEdit,
`$.process.run` (`gsd-tools frontmatter`). Overlap: none found. Risk: guard.
Grounding: spike (`files_modified` coverage in real plans unmeasured; plans
that omit it must pass silently).

**C3. Executor exit check**
When a `gsd-executor` loop completes, check that its SUMMARY.md exists and
STATE.md moved; if not, toast and add a notice row, so a silently incomplete
plan is caught at the wave boundary rather than at verify. Events:
`turn.complete` with `agentId`, `$.fs.stat`. Overlap: none found. Risk: api.
Grounding: admit.

**C4. Visible context guard with a pause button**
At gsd-core's WARNING (<= 35% left) and CRITICAL (<= 25% left) thresholds,
show the person a toast and a band with `Pause now` (fills
`/gsd-pause-work`). Today only the agent is told. Reads the same thresholds
from `.planning/config.json` (`hooks.context_warning_threshold`). Events:
`turn.step` or `turn.complete`, `$.session.measure`, `$.ui.toast`. Overlap:
partial (gsd-status-mod has a context gauge; no thresholds tied to GSD's
config, no action). Risk: api. Grounding: admit.

**C5. GSD-aware compaction**
On `session.compact`, add instructions telling the summarizer to keep the GSD
anchors verbatim (current phase and plan, locked decisions, open checkpoint,
must-haves, next command), and, if no handoff was written in the last N
minutes, toast `compacting without a GSD handoff` first. Events:
`session.compact` (rewrite `instructions` only). Overlap: none found. Risk: model;
api. Grounding: admit for the hook; abstain on whether summarizer
instructions measurably improve recall (needs an eval).

## Lane D. Shape what the model reads (highest leverage, highest risk)

**D1. Pre-resolved init for GSD workflows**
Many workflows start by running `gsd-tools init <workflow>` through Bash and
reading the JSON back (64 of 89 top-level workflow files match a loose grep
for an init call; not checked one by one). On `skill.prompt` for a `/gsd-*` skill, the mod runs
that init itself and appends its JSON to the skill text, saving one tool round
trip per workflow start. Events: `skill.prompt` (append), `$.process.run`.
Overlap: none found. Risk: model (workflow text changes; gsd-core's gates assume
their own text); api. Grounding: spike (which workflows take which init verb;
whether an appended block is honored or re-run anyway).

**D2. Live "GSD now" system-prompt section**
A short `session`-scoped section: project, phase, plan, status, next command.
Updated only when the phase or plan changes (`$.ui.invalidate("prompt.section")`
on change), because every change spends the prompt cache. Events:
`prompt.compose`. Overlap: none found. Risk: model; cache cost. Grounding: admit for
the hook; abstain on net value (the model can read STATE.md itself).

**D3. Reminder trimming**
Drop or shorten engine reminders that conflict with GSD (for instance a
todo reminder nudging TodoWrite while GSD tracks tasks in PLAN.md). Events:
`prompt.attachment` with `{ text: null }`. Risk: model. Grounding: abstain
(which reminders actually conflict was not checked).

## Lane E. Model-assisted helpers

**E1. "Why is GSD doing this?" button**
A band button that asks `$.model.fork` one tool-less question over the live
transcript ("which GSD workflow step is running and why, in two sentences")
and shows the answer in a toast. Prompt-cached prefix keeps it cheap.
Events: `$.model.fork`, `ui.render`. Overlap: none found. Risk: api. Grounding:
admit.

**E2. Checkpoint pre-read**
When a human-verify checkpoint arrives, a fork summarizes what to check
("open /login, submit empty form, expect inline error") as a short list in the
checkpoint card (A2). Events: `$.model.fork`. Risk: api. Grounding: admit.

**E3. Plan smell check**
After a PLAN.md is written, a `$.model.complete` call with a small model scores
it against a short rubric (task count, verify commands present, files declared)
and shows flags. Overlap: gsd-plan-checker exists inside the workflow; this is
a cheaper, visible pre-check. Risk: api; may duplicate plan-checker. Grounding:
abstain.

## Lane F. Unattended runs (`/gsd-autonomous`, long execute waves)

**F1. Waiting-on-you alerts**
When an unattended run hits a checkpoint, a blocker or a stall, play a sound,
raise a toast and (where enabled) a system notification, so the person who
walked away learns the run stopped. Events: `turn.complete`, `$.audio.play`,
`$.ui.toast`. Overlap: partial (gsd-status-mod toasts on long agents). Risk:
api. Grounding: admit.

**F2. Stall surfacing**
Show `gsd_stall_watch` state (plan-phase.md:732) and a background agent with no
output for N minutes as a warning chip, with `Show last tool call`. Overlap:
partial (typical-time amber clock). Risk: api. Grounding: spike.

**F3. Run journal**
A compact per-run log (`.planning/runs/<date>.md`, opt-in): phases entered,
checkpoints answered, gates tripped, commits, wall time. For a morning-after
read of an overnight autonomous run. Events: `turn.complete`, `tool.call`
(observe), `$.fs.write`. Risk: write. Grounding: admit.

## Lane G. gsd-core contributor pack (maintainers, not end users)

**G1. Generated-copy guard**: refuse Edit/Write to `gsd-core/bin/lib/X.cjs` when
`src/X.cts` exists, naming the twin. **G2. Changeset reminder** before
`git push` when shipped dirs changed with no `.changeset/*.md`. **G3. ADR lens**:
on opening a `src/*.cts` file, a pane lists the ADRs its comments cite
(`grep ADR-`) with titles from `docs/adr/README.md`. **G4. Stale-build chip**:
`src/*.cts` newer than `bin/lib/*.cjs`. All: `tool.call`, `$.fs.stat`,
`ui.render`. Risk: guard. Grounding: admit. Audience is small; packaged
separately from the user-facing mods.

## Lane I. Added after the web pass

**I1. Wave board** (from flowpane / agentpane / Warp task lists)
A pane laid out as execute-phase's waves: one column per wave, one card per
plan with status (pending / running / done / failed / checkpoint), elapsed
time, commits so far, and a SUMMARY.md tick. Driven by the `[checkpoint]`
heartbeat lines plus `phase-plan-index N` (wave, depends_on, has_summary).
Overlap: partial (gsd-status-mod shows an agent tree and a pace box with
waves, not a per-plan board). Risk: api. Grounding: admit (heartbeat format
verified); spike (heartbeats are model-printed prose, so a skipped line leaves
a card stale; reconcile from SUMMARY.md files).

**I2. Guard holds with an explanation** (from blast-radius)
When one of gsd-core's own guards denies a call (write guard, worktree path
guard, isolation guard), the transcript shows the deny text only. A hold pane
shows which GSD rule fired, the rule's one-line rationale and the fix.
Observe-only: reads the denial after `next`, never changes it. Risk: api.
Grounding: spike (whether a classic PreToolUse deny reaches a mod's
`tool.call` result readably).

**I3. `/gsd-ask` side question** (from aside)
`/gsd-ask what did we decide about auth` answers through `$.model.fork` over
the live transcript, or through `$.model.complete` over CONTEXT.md decisions
(`D-NN`) and SUMMARY key-decisions, without spending the main context. Risk:
api. Grounding: admit.

**I4. Plan replay** (from replay-theater)
`/gsd-replay 03-02` steps through one plan's commits (git log over the plan's
commit range from SUMMARY.md) as diffs in a pane, before or during verify.
Events: `process.run` git, `ui.render` Pane with `Code format: 'diff'`.
Risk: api. Grounding: abstain (how SUMMARY.md records the commit range not
checked).

**I5. Assumptions pinboard** (from pinboard)
A pane of CONTEXT.md decisions and `[ASSUMED]` rows that still need a person
to confirm, each with Confirm / Revise buttons that fill a prompt. Risk: api.
Grounding: abstain (`[ASSUMED]` marker usage not counted).

**I6. Cross-artifact consistency light** (from Spec Kit analyze)
A small light that turns amber when PLAN requirements, REQUIREMENTS.md IDs and
ROADMAP coverage disagree, from `validate consistency`. Risk: api. Grounding:
spike (verb output and cost on a large project not measured).

**I7. GSD-role spinner** (from clawdhouse)
The Spinner site shows the active GSD role and plan (`executor 03-02`,
`plan-checker round 2`) instead of the generic verb. Events: `ui.render`
Spinner, `$.agent.list`. Risk: api. Grounding: admit.

**I8. Undo pane** (from Cline checkpoints)
`/gsd-undo` presented as a pane: pick a phase or plan, see its commits, choose
revert-commits or restore-files. Calls gsd-core's own `select-revert-commits`
verb; never reverts by itself, fills the command. Risk: write (indirect).
Grounding: spike.

## Lane H. Multi-session

**H1. Phase claims across sessions**
Two sessions in one project announce which phase/plan each holds
(`session.send` / `session.receive` or a lock file); the band shows
`phase 4 held by another session`. Relates to gsd-core #4845 (per-session
pause). Risk: api; write. Grounding: spike.
