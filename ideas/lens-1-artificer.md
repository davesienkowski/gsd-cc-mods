# Lens 1: Artificer laws-of-software pass over the catalog

Laws applied: design-review preset (Gall, boring technology, Conway,
Greenspun, Zawinski) plus Hyrum, Postel, leaky abstractions, Kerckhoffs,
Goodhart, Shirky and Fitts, which the catalog's guard, parsing, metric and UI
content triggers. Laws considered and not applied: Knuth/Wirth (no
optimization claim), Hofstadter/Parkinson (no estimates made), Peter, Doerr,
Linus, Lovelace, Norvig, Moore (no matching signal).

## Gall's law: one working mod before a suite

The catalog has 45 ideas on an API that shipped 2026-10-01. A complex system
that works evolves from a simple one that worked. **Action:** ship one small,
complete mod first, learn which API behaviors hold in a live session (the
first GSD mod's author found that `claude plugin validate` passed a module the
loader refused), then grow. The first mod should exercise the riskiest shared
plumbing (resolving the right gsd-tools, project root in worktrees,
refresh-per-turn) behind the smallest user-facing surface.

## Zawinski's law: set the scope boundary now

Several ideas move the mods from "show GSD's state and put its next move one
key away" toward "reimplement GSD's workflow logic in a second place":
E3 (plan smell check duplicates gsd-plan-checker), B4 (intent router
duplicates `/gsd-progress --do` and smart-entry routing), D1 (pre-running
`init` changes how workflows start), A5/A6 partly re-derive verifier verdicts.
**Scope rule adopted:** a mod may display what gsd-core computed, and may
offer an action gsd-core already has. It may not compute a GSD verdict of its
own or change a workflow's text. E3 and B4 are cut on this ground; D1 moves to
"upstream proposal" (see Shirky).

## Hyrum's law: prose is not a contract, so don't make it one

Ideas A1, A2, I1 and F2 parse model-printed prose (stage banners,
`[checkpoint]` heartbeat lines, `-> YOUR ACTION` boxes). gsd-core's
maintainers edit workflow wording freely; with a mod depending on it, every
rewording silently breaks the mod, and the observable behavior becomes a
contract no one agreed to. Conversely, versioned feeds exist:
`planning inspect` carries `schema_version: 1`; `smart-entry --json`,
`phase-plan-index`, `verification status` are CLI verbs with tests.
**Action:** feeds rank `planning inspect` / CLI JSON > file frontmatter >
prose markers. A prose parser is allowed only as a hint layered over a
file-backed truth (for I1: SUMMARY.md existence decides "done"; a heartbeat
line can only make a card "running" sooner).

The law also binds this repo: anything the mods write (a DECISIONS export, a
run journal) becomes a format someone depends on. Keep writes opt-in, and
version any file format from its first release.

## Postel's law: liberal in, visible about it

Frontmatter fields go missing (`active_phase` and `next_phases` are read by
the statusline but no writer was found in `src/` or workflows; plans may omit
`files_modified`). **Action:** when a field or marker is absent, the mod shows
"unknown", never a stale or guessed value (gsd-status-mod reached the same
rule for the current phase). Guards are the conservative side: C2 must pass
silently when a plan declares no `files_modified`, never deny on absence.

## Leaky abstractions: gsd-tools hides things that matter to a mod

Measured or read this session: from a linked worktree, `planning inspect`
resolved the main checkout's `.planning`; a config warning prints on stderr
beside JSON on stdout; JSON over ~50 KB comes back as an `@file:` path;
workstreams change which STATE.md is read. **Action:** one shared adapter
(`gsd()`), written once, that passes `--project-dir`, splits stderr, follows
`@file:`, passes `--ws`, applies a timeout, and caches per turn. Every mod uses
it; none calls `process.run` directly.

## Kerckhoffs: mods are not sandboxed, and the repo is untrusted input

A mod's process runs outside the Bash sandbox (official docs). If the adapter
resolved gsd-tools the way workflows do (project-local
`<repo>/gsd-core/bin/gsd-tools.cjs` first), opening a cloned repository would
run that repository's code at session start, unprompted. **Action:** the
adapter runs only the user's installed gsd-core (the global install path, or a
path set in the mod's `userConfig`), never a path found inside the working
tree, and verifies `runtime-identity` before first use. Guards (lane C) are
workflow hygiene, not a security boundary: the model can reach the same effect
through another tool, so they must never be described as protection.

## Shirky: don't build a permanent workaround for a fixable upstream gap

The checkpoint inbox (A2) and the active-workflow band (A1) exist because GSD
emits its "waiting on you" and "current stage" state only as prose. gsd-core
already has the structured answer half-built: `state signal-waiting` writes
`.planning/WAITING.json` (status, type, question, options, since, phase), and
`init` reads it back as `waiting_signal`, but no workflow calls the writer.
A mod that scrapes prose forever manages the problem; the solution is one
upstream change. **Action:** build A2 on WAITING.json when present with prose
as fallback, and draft an upstream issue proposing that checkpoint-emitting
workflows call `state signal-waiting`. Same for D1: propose it upstream
rather than rewriting skill text from outside.

## Greenspun: no rule language for guards

Lane C's per-rule config must stay a fixed list of named rules, each
`off | warn | deny`. No user-written patterns, no conditions. If users need
custom rules, that is what Claude Code's own permission rules and settings
hooks are for.

## Goodhart: show cost and pace, never score them

A8 (cost per phase) and the pace metrics are useful as information. Shown as a
target ("phase cost budget", "velocity"), they invite splitting phases to look
cheap. **Action:** no budgets, no red/green on spend, no cross-phase ranking.

## Fitts: the band is the target nearest attention

Most-frequent actions (accept the next move, answer a checkpoint) belong in
the band above the prompt with digit hotkeys, not in a pane that seats only
from 144 columns. Destructive or refusing actions (Deny, Revert) never sit
adjacent to the default action and never take the `1` hotkey.

## Conway: two audiences, two plugins

GSD users and gsd-core contributors have different needs and release
cadences. Lane G ships as its own plugin (`gsd-core-contrib-mod`), so user
mods never carry contributor guards.

## Boring technology

No dependencies, no datastore beyond `$.store`, no build step beyond what
Claude Code compiles. Each mod is plain TS/TSX against the generated types.

## Verdict summary

| Effect | Ideas |
|---|---|
| Cut (scope) | E3, B4 |
| Move to upstream proposal | D1, the structured half of A1/A2 (WAITING.json callers) |
| Reshape (file-backed truth, prose as hint only) | A1, A2, I1, F2 |
| Constraint added (adapter, installed gsd-tools only) | every idea that calls gsd-tools |
| Constraint added (absent field = unknown / silent pass) | A5, A6, C2 |
| Separate plugin | G1-G4 |
