# gsd-pilot

A Claude Code mod that puts the right [GSD](https://github.com/open-gsd/gsd-core)
move one keystroke away. It shows what gsd-core already computed and offers it
as buttons that **fill** the prompt; you press Enter.

Status: **v0.2.0.** Validated, type-checked and unit-tested against Claude
Code 2.1.291; live check pending.

## What you get

- **`/gsd`**: a palette pane, docked on the right in the gsd-status-mod
  style and opened on session start in a GSD project (option `openOnStart`,
  on by default). It opens on its own only in Claude Code's fullscreen layout
  (`/tui fullscreen`); on the main screen you get one hint, once, and `/gsd`
  opens it above the prompt. If it has to wait for width (an unasked pane
  needs 144 columns, 110 once you have opened it by hand), it says so. See
  "Panes (and Orca)" in the repository README.
  - The milestone, the situation gsd-core reports, plan progress, and which
    `.planning` it is reading (said when that is not your working folder, for
    example from a linked worktree).
  - A **verification card** for the first phase not yet complete: its status
    (`MISSING`, `STALE`, `GAPS_FOUND`, `PASSED`...), gsd-core's next action, and
    the command for it (`v`).
  - **Moves that fit now**: gsd-core's own `smart-entry` actions as buttons
    `1`-`9`, the recommended one highlighted. A move whose command is not
    installed in this session is shown greyed and fills nothing.
  - Keys reach the pane after ctrl+x then tab; clicks reach it in the
    fullscreen terminal.
- **`/gsd-grab [todo|note|seed|backlog]`**: fills `/gsd-capture` with the text
  you selected in the transcript.
- **`/gsd-attach phase <N> | plan <NN-MM>`**: puts `@`-mentions for that
  phase's CONTEXT/RESEARCH/PLAN/VERIFICATION/UAT files, or that plan's PLAN and
  SUMMARY, into your prompt.

## Where the facts come from

`gsd-tools planning inspect` (one schema-versioned snapshot of `.planning`) and
`gsd-tools smart-entry --json` (the moves), read after each main-loop turn and
on `/gsd`. Nothing is parsed out of markdown by this mod.

## Rules it keeps

- Runs only the gsd-core installed under your Claude config dir
  (`$CLAUDE_CONFIG_DIR` or `~/.claude`), proven with `runtime-identity` before
  first use. It never runs a `gsd-tools.cjs` found inside the working tree:
  mods are not sandboxed, and that would run a cloned repo's code unasked.
- Fills the prompt; never submits a command, never runs a GSD command itself.
- Writes no files, makes no network calls.
- Computes no GSD verdict of its own; if gsd-core reports no phase, it shows
  none.
- gsd-tools still answers some moves in the retired colon form
  (`/gsd:progress`); the palette uses whichever spelling this session's command
  list actually has.

## Develop

    claude plugin validate .
    claude plugin test .
    claude --plugin-dir .
