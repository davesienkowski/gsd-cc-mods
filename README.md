# gsd-cc-mods

Research, design and (later) source for Claude Code **mods** that make
[GSD (gsd-core)](https://github.com/open-gsd/gsd-core) state visible and usable
inside a Claude Code session.

A Claude Code mod is a plugin of function hooks (a TypeScript/TSX module
exporting `register(on, options)`) that runs inside the session and can draw
panes, a band above the prompt, status entries and toasts, react to or guard
tool calls, add slash commands, tools and subagent types, and call the model.
Mods shipped in Claude Code 2.1.287 (2026-10-01); the API is early access.

## Why out of tree

gsd-core declined an in-tree mod adapter for now
([#5174](https://github.com/open-gsd/gsd-core/issues/5174),
`.out-of-scope/claude-code-mod-adapter-in-core.md`, revisit on or after
2026-11-01). That record explicitly does not cover a standalone mods plugin,
which is what this repository is.

## Layout

- `research/` - prior art, the mod API surface, and a map of gsd-core's
  user-facing state and friction points.
- `ideas/` - the idea catalog, adversarial review, and the shortlist.
- `mods/` - mod source, once a design is chosen.

## Reading order

1. `ideas/shortlist.md` - the proposed mods (gsd-whisper first), the spikes
   that gate them, and upstream proposals.
2. `ideas/catalog.md` - all 44 raw ideas across nine lanes, pre-review.
3. Review lenses: `ideas/lens-1-artificer.md` (laws of software),
   `ideas/lens-2-adversarial.md` (refute pass, re-checked),
   `ideas/lens-3-probes.md` (edge cases and prohibitions),
   `ideas/lens-4-quantifiers.md` (wording audit).
4. Research: `research/mod-api-surface.md`, `research/prior-art-gsd.md`,
   `research/prior-art-web.md`, `research/gsd-friction-map.md`.

## Status

- `mods/gsd-pilot` v0.2.0: `/gsd` palette of the moves that fit now, phase
  verification card, `/gsd-grab`, `/gsd-attach`. Docks on session start (see
  Panes below). Unit-tested; live check pending.
- `mods/gsd-whisper` v0.3.0: shows what gsd-core's hooks tell the agent (tool-row
  cards, history pane, CRITICAL band). Mechanism confirmed live; see
  `research/spike-results-gsd-whisper.md`.
- [helenkwok/gsd-status-mod](https://github.com/helenkwok/gsd-status-mod) by
  Helen Kwok (MIT): the live GSD dashboard pane, status band and next-action
  hint. Listed in this repository's marketplace and installed from her
  repository, so it stays on her releases; no copy of it lives here.

## Install

This repository is a marketplace. In a terminal session:

    /plugin install gsd-pilot --marketplace davesienkowski/gsd-cc-mods
    /plugin install gsd-whisper --marketplace davesienkowski/gsd-cc-mods
    /plugin install gsd-status-mod --marketplace davesienkowski/gsd-cc-mods

Install gsd-status-mod from one marketplace only (this one or
`helenkwok-mods`): both copies register `/gsd-status`, `/gsd-board` and the
pane id `gsd-board`.

To try a mod from a clone without installing: `claude --plugin-dir mods/<name>`.

## Panes (and Orca)

gsd-pilot and gsd-whisper use gsd-status-mod's pane setup: a pane docked on
the right of the transcript, asking for 64 columns, drawn as a centred header
over round-bordered panels, each with its title on the left and a note on
the right, with keys after ctrl+x then tab. gsd-pilot opens it on session
start (`openOnStart`, on by default); gsd-whisper has the same option, off by
default. Three panes share one dock as tabs.

Where the pane appears is Claude Code's decision, not the mod's:

- **Layout.** A pane docks beside the transcript only in Claude Code's
  fullscreen layout. On the main-screen layout (`"tui": "default"` in
  `~/.claude/settings.json`, and tmux by default) it opens inline above the
  prompt instead. Switch with `/tui fullscreen` (Claude Code saves the choice
  and relaunches with the conversation intact) or set `"tui": "fullscreen"`.
  This is the setting that gives the side pane in Orca's terminal.
- **Width.** A pane opened by a command (`/gsd`, `/gsd-whisper`, `/gsd-board`)
  docks from 110 columns. A pane opened on its own at session start needs 144
  columns, or 110 if you opened that pane by hand before and have not closed
  it with its close mark since. An Orca terminal split side by side is often
  narrower than 144: run the command once, or widen the Orca pane.

What gsd-pilot and gsd-whisper add on top of that setup:

- They open on their own only in the fullscreen layout, where the pane is a
  sidebar. On the main screen they show one hint, once, saying to run
  `/tui fullscreen`, instead of taking rows above the prompt.
- When an unasked open has to wait (a narrow split), they say why and name the
  command that opens it now, instead of failing silently.

gsd-status-mod in Orca, from its own code and README (v0.7.0):

- It opens at session start at 144 columns or more on either layout, so on
  the main screen it sits above the prompt. Use the fullscreen layout, or turn
  its `openOnStart` option off and use `/gsd-board`.
- In a linked worktree with no `.planning` of its own (an Orca worktree, for
  example) it reads the main checkout's `.planning`, which is wrong when that
  worktree is on a different phase. gsd-pilot reads through gsd-tools from the
  session's folder and says which `.planning` it is reading.

Not checked live in Orca yet: mouse clicks in a docked pane, and whether Orca
passes ctrl+x through to Claude Code.

## License

MIT
