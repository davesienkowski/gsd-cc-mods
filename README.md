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

- `mods/gsd-whisper` v0.2.2: shows what gsd-core's hooks tell the agent (tool-row
  cards, history pane, CRITICAL band). Mechanism confirmed live; see
  `research/spike-results-gsd-whisper.md`.
- `mods/gsd-pilot` v0.1.0: `/gsd` palette of the moves that fit now, phase
  verification card, `/gsd-grab`, `/gsd-attach`. Unit-tested; live check
  pending.

Install either from a clone with `claude --plugin-dir mods/<name>`.

## License

MIT
