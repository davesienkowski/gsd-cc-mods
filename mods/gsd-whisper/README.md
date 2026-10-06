# gsd-whisper

A Claude Code mod that shows you what [gsd-core](https://github.com/open-gsd/gsd-core)'s
own hooks quietly tell the agent: context warnings, read-before-edit and
workflow advice, `.planning` edit reminders, and guard denials (secret reads,
worktree paths, catastrophic STATE/ROADMAP shrinks, commit format, agent
isolation).

Status: **v0.1 spike.** Validated, type-checked and unit-tested against
Claude Code 2.1.291's mod API; the live-session check (does a mod really see
gsd-core's hook output, for settings.json installs and plugin installs) is in
progress. See `../../ideas/shortlist.md` spike S1-S3.

## What you see

- A dim transcript line when a gsd-core hook speaks to the agent:
  `GSD told the agent: context warning (34% left): agent told to wrap up`,
  `GSD blocked Read: Secret read guard: Read would read '.env' ...`.
  The same message is said at most once a minute.
- A toast at gsd-core's context WARNING and CRITICAL thresholds.
- At CRITICAL, a band above the prompt with **Pause work** (fills
  `/gsd-pause-work` into the prompt; you press Enter) and **Dismiss**.
- `/gsd-whisper`: the last 15 messages and per-event counts.

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
