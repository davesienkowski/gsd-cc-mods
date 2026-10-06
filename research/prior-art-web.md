# Prior art outside GSD (web, 2026-10-06)

Tags: [admit] = re-checked against the primary page in this session;
[lead] = reported by a research pass from a fetched README or doc, not
re-checked line by line; [abstain] = not verified.

## Official mods

- `anthropics/claude-code/mods/` holds four built-in mods: `sec-default`,
  `diff`, `telemetry`, `agents-md` [admit: README.md and the directory listing].
  - `diff`: `/diff` pane of uncommitted hunks, refreshed as Claude edits and
    runs commands. Patterns: Pane + PromptHint, `process.run` git calls, timers,
    a button that rides a file's hunks onto the next prompt [lead].
  - `sec-default`: seated outermost; keeps org-managed hooks, prompt sections,
    settings and deny rules out of reach of installed mods [admit].
  - `agents-md`: loads AGENTS.md like CLAUDE.md via `prompt.context` [admit].
  - `telemetry`: adds a `$.telemetry` noun in `engine.create`, refuses
    installed plugins [admit].
- Tests: `claude plugin test <dir>`, `tier(...)`, `mock.env/store/clock`; a call
  left unanswered beneath the mod throws [admit: README].
- Playground samples in `anthropics/claude-code-playground`: `blast-radius`
  (holds risky Bash and shows its effect with Proceed/Cancel), `replay-theater`
  (`/replay` steps through the last turn's edits), `token-weather` (context
  forecast + sparkline band) [lead].

## Platform facts that shape GSD mods [admit: code.claude.com/docs/en/plugins/mods]

- Mods aren't sandboxed; a process a mod starts runs outside the Bash sandbox.
- Where they run: CLI and the Desktop Code tab draw UI. The VS Code chat panel
  and cloud sessions run hooks but draw nothing. Desktop WSL sessions load no
  plugins at all. So guard and prompt-shaping mods reach more surfaces than
  pane/band mods.
- Budgets: 10 s of a hook's own time per event (50 ms for `prompt.edit`); all
  `session.end` hooks share 1.5 s; `$.fs` 4 MiB per file; `$.store` 4 MiB total;
  redraws throttled to 10/s (30/s for the visible pane, band and hint line); an
  unasked pane seats from 144 columns (110 once the user has opened it).

## Community

- `karanb192/awesome-claude-code-mods` (209 stars): a scanned catalogue of
  public mods with what each can read, write, run or send; browse at
  mods.aidojo.si [admit: repo metadata]. Its mod count is a scanner count.
- `helenkwok/gsd-status-mod`: the existing GSD mod (see prior-art-gsd.md)
  [admit].
- Design thread anthropics/claude-code#91870 opened 2026-09-03 [lead].

## UX inspirations and their GSD translation [lead unless marked]

| Source | What the user sees or does | As a GSD mod |
|---|---|---|
| blast-radius | Risky command held, effect shown, Proceed/Cancel | Turn GSD's guard denials into holds with an explanation |
| replay-theater | `/replay` steps through a turn's edits | Step through one plan's commits before verify |
| token-weather | Context forecast in the band | GSD-threshold context band with a pause action |
| diff mod | Button rides hunks onto the next prompt | "Ask about this phase" rides PLAN.md onto the next prompt |
| cc-plugin-you-should-know (built-in, off by default) | A side agent posts notes above the prompt | Side reviewer posting drift findings during execute |
| flowpane (mpolatcan) | Phase graph replacing a progress list | Execute-phase wave DAG with per-plan status |
| qrspi-pane | Each task's phase, blocker and next command | Phase cards with blocker and next `/gsd-*` |
| ak-cockpit (thieung/claude-mods) | Context fill with a handoff nudge | Band suggests `/gsd-pause-work` at GSD's threshold |
| phase-runner-hud | Running phase in status; toast when the run needs you | Checkpoint toast + status marker |
| pinboard | Pane of open decisions and todos fed by its own tool | CONTEXT.md decisions and `[ASSUMED]` rows awaiting confirmation |
| aside | Read-only side chat, tool-less fork answers | `/gsd-ask "what did we decide about X"` without spending main context |
| agentpane / flightdeck | Subagent cards and swimlanes with Stop | Wave executors as swimlanes by plan id |
| todo-bar | Task list as a progress bar | Plans-with-SUMMARY over plans, per phase |
| receipt | Per-turn files/lines/commands; toast on loops | Per-plan receipt checked against `files_modified` |
| next-steps (pawandeepdhall) | Model-generated next-step buttons | Routed next commands as numbered buttons (from gsd-tools, not a model guess) |
| usage-band | Commit-and-push buttons | "Verify" / "Ship" buttons that appear once a gate passes |
| agent-quick-menu | JSON-declared command pane | State-filtered GSD command palette |
| linear-mod | Click a ticket to load it | Click a roadmap phase to prefill `/gsd-plan-phase N` |
| mdview | Read markdown in a pane; point at a block to have Claude edit it | Comment on a PLAN.md block, route the comment into plan revision |
| clawdhouse | Mood mapped from tool events | Spinner shows the active GSD role (planner / executor / verifier) |
| Kiro specs | Per-task "Start task"; run-all in dependency order | Start buttons on PLAN tasks; "run this wave" |
| Cline checkpoints | Compare/Restore: task, workspace, or both | `/gsd-undo` as a pane with those restore choices |
| Linear agent API | pending / inProgress / completed / awaitingInput / stale | A shared status vocabulary for every GSD pane |
| Warp task lists | Color-coded tasks; toast when one blocks | Same, per plan in a wave |
| Roo boomerang | Navigable parent/child task tree | Breadcrumb milestone > phase > plan > subagent |
| Taskmaster | `next` with dependencies met; complexity report | "Ready next" plus a per-plan complexity badge |
| Spec Kit analyze | Cross-artifact consistency check | Live warning when CONTEXT, PLAN and REQUIREMENTS disagree |
| pi / OpenCode plugins | Pickers, toasts, `tool.execute.before` | Confirms observe/deny + toast is the cross-agent norm |

Not fetched: the launch blog posts (claude.com/blog/claude-code-mods,
claude.dev/blog/getting-started-with-claude-code-mods) [abstain].
