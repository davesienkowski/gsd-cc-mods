# Lens 3: edge probes and prohibition recall

Applied to the ideas that survived or were reshaped in lenses 1 and 2. Each
probe is a situation every shortlisted mod must have an answer for; the
shortlist names the answer per mod.

## Edge probes

| # | Situation | Why it bites | Required behavior |
|---|---|---|---|
| EP1 | Not a GSD project (no `.planning/`, or a `.planning/` that is not GSD's) | Draws noise in every other repo | Detect via `gsd_state_version` in STATE.md frontmatter or a successful `planning inspect`; otherwise draw nothing and register no guard |
| EP2 | Linked git worktree (GSD executors run in them) | No `.planning/` in the worktree; gsd-tools silently resolves the main checkout | Resolve the project root once, explicitly, and pass `--project-dir`; say in the UI which checkout is shown when it is not the cwd |
| EP3 | Workstreams (`.planning/workstreams/<name>/`) | Two STATE.md files; the active one is per session | Pass `--ws` when `.planning/active-workstream` names one; show the workstream name |
| EP4 | gsd-core not installed, or an older version without `planning inspect` / `smart-entry --json` | Adapter calls fail | `runtime-identity` + version check at session start; degrade to the subset that needs no CLI (A7, I2, F1) and say so once |
| EP5 | Project-local `gsd-core/bin/gsd-tools.cjs` inside an untrusted clone | Mods are not sandboxed; running it is arbitrary code execution | Never execute a gsd-tools found under the working tree (lens 1, Kerckhoffs) |
| EP6 | Surface draws nothing (VS Code chat panel, cloud, `claude -p`) | UI-only mods silently do nothing; guards still run | Guards and observers must not assume a person saw a card; a `warn` guard that cannot draw logs and allows |
| EP7 | Terminal narrower than 144 columns | Unasked panes do not seat | Nothing important lives only in an unasked pane; panes open on a command |
| EP8 | gsd-status-mod co-installed | Crowded band, duplicate drift/next hints | Do not draw `AbovePrompt` by default; never re-show its band, hint, drift or context gauge |
| EP9 | Subagent loops (`agentId` set) | `tool.call`, `turn.complete`, `session.compact` fire per subagent | Each hook declares main-only, subagent-only, or both |
| EP10 | TEXT_MODE (69 references in top-level workflows) | No AskUserQuestion tool call to observe | State the gap in the UI; do not claim a complete ledger |
| EP11 | Null or stale active phase | `state-snapshot.current_phase` was null on a live project | One null-safe resolver; hide phase-keyed UI on null, never guess |
| EP12 | Large `.planning` | CLI returns `@file:` past ~50 KB; `$.fs` caps at 4 MiB | Adapter follows `@file:`; per-turn cache; never call the CLI from `ui.render` |
| EP13 | Hot reload / session resume | Module variables reset; `$.state` survives | Draw only from `$.state`; rebuild caches on `session.start` |
| EP14 | Hook budget (10 s own time; `session.end` 1.5 s shared) | A slow CLI call inside a hook | Timeouts under budget; no CLI on `session.end` |
| EP15 | Windows paths / CRLF in markdown | Frontmatter parse and path compare | Use CLI JSON, not regex over files; compare `realPath` |
| EP16 | Two sessions in one project | Both mods react to the same files | No cross-session writes in v1 |

## Prohibition recall

Rules no shortlisted mod may break, with where each comes from.

| # | Prohibition | Source |
|---|---|---|
| P1 | Never rewrite tool input; observe or deny only | #5174 field report: a mod's rewrite changes what gsd-core's guards see (T:1194 ordering) |
| P2 | Never rewrite workflow or skill text (`skill.prompt` answer) | Lens 1 (Hyrum, Zawinski); lens 2 D1 |
| P3 | Never write inside `.planning/` without an explicit, per-action user press | GSD owns that state; writes dirty git (lens 2 F3) |
| P4 | Never auto-submit a prompt; fill only (`$.prompt.fill`) | The person stays the one who runs a GSD command |
| P5 | Never deny by default; every guard ships `warn` | Lens 2 C1/C2 misfire evidence |
| P6 | Never execute code from the working tree | Lens 1 (Kerckhoffs), EP5 |
| P7 | No network, no telemetry, nothing off the machine | Matches gsd-core's statusline data boundary (ADR-2164) and keeps the mods auditable on the awesome list's scanner |
| P8 | Never compute a GSD verdict the CLI does not compute | Lens 1 (Zawinski) |
| P9 | Never show a guessed value; absent is "unknown" or hidden | Lens 1 (Postel) |
| P10 | Never store transcript text or prompts in `$.store` | Privacy; gsd-status-mod set the same bar |
| P11 | Never re-draw what gsd-status-mod or gsd-core's statusline already shows | Lens 2 gap 1 |
| P12 | Never present a guard as a security control | Lens 1 (Kerckhoffs) |
