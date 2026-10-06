# gsd-whisper

A Claude Code mod that shows you what [gsd-core](https://github.com/open-gsd/gsd-core)'s
own hooks quietly tell the agent: context warnings, read-before-edit and
workflow advice, `.planning` edit reminders, and guard denials (secret reads,
worktree paths, catastrophic STATE/ROADMAP shrinks, commit format, agent
isolation).

Status: **v0.2.1 (UI), mechanism confirmed live** (Claude Code 2.1.291,
gsd-core hooks installed through settings.json): the mod saw a gsd-core
PostToolUse advisory and a PreToolUse deny in a real session. Plugin-install
gsd-core is not yet checked. Results: `../../research/spike-results-gsd-whisper.md`.

## What you see

- **A card under the tool row** a gsd-core hook spoke about: a rounded border
  in the message's colour on the same subtle background Claude Code gives your
  own prompt rows (the theme's `userMessageBackground`), so it reads in any
  theme. The most severe message leads: `GSD [ BLOCKED ] secret-read-guard: Secret read guard: Read would
  read '.../spike/.env' ...` or `GSD [ ADVISED ] phase-boundary: .planning edit
  (...)`. Reads and searches that fold into one group line get one badge on
  the group, led by a block if there is one.
- **A toast** for a message tied to no tool call (session start, Stop), at
  most once a minute per message, and at gsd-core's context WARNING and
  CRITICAL thresholds.
- **At CRITICAL, a band above the prompt** with **Pause work** (fills
  `/gsd-pause-work` into the prompt; you press Enter) and **Dismiss**.
- **`/gsd-whisper`** opens a pane: counts (blocked / asked / advised) and the
  session's history, newest first, with a Clear button. Where no pane can be
  placed it answers with the same history as text.

## What it never does

- It never changes what the model receives and never decides a tool call:
  every hook calls `next(e)` first and returns that result unchanged, and a
  failure inside the mod falls through to `next(e)`.
- It never sends a prompt; Pause only fills the prompt box.
- No network, no files written, no processes run.
- It recognizes only gsd-core's own hook messages, by their opening text as
  written in `gsd-core/hooks/` on `next` (2026-10-06). Other hooks' output is
  counted and left alone.

## How it works

Claude Code runs a classic event's chain as
`[managed settings hooks, ...hooks modules, the other settings hooks]`, so a
mod's `await next(e)` returns what the settings hooks answered:
`additionalContext`, `block`, and for PreToolUse `deny` / `ask`.
Texts arrive merged with no per-hook attribution, which is why recognition is
by message text.

## Spike aid

v0.1 also registers a read-only model tool, `mcp__gsd-whisper__report`, so an
agent in a live session can read the same report and confirm what the mod
saw. It will become opt-in or go away after the spike.

## Develop

    claude plugin validate .
    claude plugin test .
    claude --plugin-dir .
