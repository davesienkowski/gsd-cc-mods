# Claude Code mod API surface (as read from the build's own types)

Source: the `claude-code.d.ts` declaration file and `reference.md` that Claude Code
2.1.291 writes for the `plugin-authoring` skill. The API is early access; the
declaration file of the running build is the authority. Read 2026-10-06.

## Shape

- A mod is a plugin folder: `.claude-plugin/plugin.json`, `hooks/hooks.json`
  (`{ "modules": ["./register.tsx"] }`), and one hooks module exporting
  `register(on, options)`.
- `on(event, matcher?, hook)`; every hook is `($, e, next)`. `next(e)` continues
  the chain; returning without `next` answers for the event; `next({...e, x})`
  rewrites what the rest of the chain sees.
- The module runs in its own environment: no DOM, no Node. Everything outside it
  is reached through `$` (fs, process, http, model, clock, store, state, ui ...).
- `$.state` is per-session host-held state (survives hot reload, redraws readers);
  `$.store` persists across sessions. Values in `$.state` are declared in a
  `types/index.d.ts` contract.

## Events (hookable)

agent.list, agent.offer, agent.register, agent.spawn, attribution.text,
command.describe, command.list, command.register, command.run, config.describe,
config.list, config.set, engine.create, mcp.call, mcp.connect, plugin.register,
process.spawn (streaming), prompt.attachment, prompt.compose, prompt.context,
prompt.mention, prompt.submit, prompt.suggest, session.append, session.compact,
session.end, session.start, skill.prompt, state.set, telemetry.*, tool.call,
tool.check, tool.describe, tool.list, tool.register, turn.abort, turn.complete,
turn.start, turn.step (streaming), ui.copy, ui.focus, ui.input, ui.press,
ui.render, ui.select, plus every classic settings hook as `classic.<Event>`.

## `$` nouns (selected)

`$.ui` (open, close, status, toast, notice, log, render, resolve, invalidate,
blit, selection, copy, focus, panes), `$.command.register`, `$.tool.register`,
`$.agent.register/spawn`, `$.model.complete/fork/classify`, `$.prompt.fill/submit`,
`$.session.messages/usage/measure/turns/append/compact/model/repo/root`,
`$.fs.read/write/list/stat/exists/ancestors`, `$.process.run/spawn`,
`$.http.fetch`, `$.clock.now/after/every/sleep`, `$.store`, `$.state`,
`$.audio.play/speak`, `$.settings.read`, `$.env.get/set`.

## Render sites (`ui.render` components)

AskUserQuestion, UserMessage, AssistantMessage, ToolUse, ToolResult, ToolGroup,
ToolProgress, CommandOutput, Spinner, TurnDuration, InfoNotice, SessionMode,
PromptHint, AbovePrompt, Pane.

- `Pane`: opened by `$.ui.open({ id, title })`. Opened by a user action, it seats
  at any width; opened unasked it seats from 144 terminal columns.
- `AbovePrompt`: a band above the prompt.
- Elements come from `$.ui.resolve(e)` per surface (terminal, desktop, vscode,
  mobile): Box, Text, Button, Input, Select, Markdown, Code (incl. diff format),
  Raster (sparklines/heatmaps), Image (kitty graphics), Svg (non-terminal), Link,
  Client.

## Guard semantics that matter for GSD

- A hook that fails is skipped unless its `.catch` answers. A guard is written
  `on(...).catch(($, e, next) => next.called ? next(e) : { deny: 'why' })`.
- A mod's `tool.call` hook runs before classic `PreToolUse` command hooks, and a
  rewrite changes what later guards see (field report in gsd-core #5174). So a
  GSD mod should observe or deny, never rewrite tool input.

## Field reports from the first GSD mod (helenkwok, gsd-core #5174 comments)

- On older Claude Code, a `hooks.json` with only `modules` fails to load; write
  `{"hooks": {}, "modules": [...]}`.
- `claude plugin validate` passed a module that the live loader refused (passing
  `$` to a const arrow function); a live-session check is needed.
- Linked worktrees have no `.planning/`; follow the `.git` pointer to the main
  checkout.
