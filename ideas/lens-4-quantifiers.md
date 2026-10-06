# Lens 4: quantifier pass

Every universal or absence word in the deliverables (every, all, none,
nobody, most, only, always, never) was listed with grep and checked against
its evidence. Prohibitions written as design rules ("never rewrite tool
input") are requirements, not claims, and were left as they are.

| Where | Before | Problem | After |
|---|---|---|---|
| shortlist.md | "What nobody draws" | Absence claim from a partial survey | "What neither of them draws, in the sources read for this study" |
| shortlist.md | gsd-status-mod is read-only, no processes, no model, no guards | Stated as fact; source is its README | Attributed: "per its README" |
| shortlist.md | "A mod sits above gsd-core's hooks" | Types say settings hooks; plugin-install hooks unconfirmed | Qualified; points at spike S1 |
| shortlist.md | gsd-hygiene "works in VS Code and cloud too" | True for `deny` only; `warn` has nothing to draw there | Split by mode |
| catalog.md | Lane A "state ... that nobody draws" | Absence claim | "that no surface read here draws" |
| catalog.md | "Every AskUserQuestion answer" (A3) | TEXT_MODE paths bypass the tool | "Each ... answer", TEXT_MODE gap stated |
| catalog.md | "Most workflows start by running init" (D1) | Unmeasured | 64 of 89 top-level files match a loose grep, not checked one by one |
| catalog.md | "reach every surface" | Desktop WSL sessions load no plugins | "every surface where mods load" |
| catalog.md | "Overlap: none" x many | Absence claim; lens 2 found four wrong (A4, A9, B1, C4) | "none found", legend states the scope of the search |
| gsd-friction-map.md | "47 of 89 ... 60 counting nested" | Earlier draft said "about 60" from an unsampled subagent count | Recounted and fixed before lens 4 |
| lens-2-adversarial.md | Reviewer tally 6/26/9 over 41 | Did not match its own table | Recounted from the table: 10/23/11 over 44 |

Claims kept as stated, with their evidence: the gsd-tools timings
(0.15-0.27 s, measured on one project, one run each: a floor-quality sample,
not a benchmark); "no cost tracking found" (scoped to the paths searched);
"no workflow calls `state signal-waiting`" (grep over workflows, agents and
commands returned nothing); "only the statusline reads `active_phase`" (grep
over src, workflows, agents).
