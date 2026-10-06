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

## Status

Exploration. Nothing here is installable yet.

## License

MIT
