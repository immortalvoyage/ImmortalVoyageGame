# First Settlement V2 vertical-slice candidate

This slice provides the first formal-life Content Pack candidate needed to exercise a mortal day beyond the old `dev-starter` fixture. It is a gameplay vertical slice, not final opening-world lore canon. Location/NPC names are deliberately low-lore placeholders until the novel/opening-world SSOT fixes the final names and historical context.

## Minimum topology

The pack contains one central settlement entry, one maintained public water source, one nearby free food fallback, one basic market, one legal lodging/rest location, three adjacent routes from the settlement entry, three small NPC roles, and two employer-backed jobs at different workplaces. A single entry-level work completion can pay for basic bread, while water and a small amount of food still have no-money fallback paths.

The two jobs use the Employment contract introduced in schema v7. A player must be at the correct workplace and accept the matching employer's offer before the corresponding work action can pay. The second job therefore also demonstrates resign → move → accept a different employer instead of treating every job as a global button.

## Location-scoped rest

The previous Survival primitive allowed `survival.rest` everywhere. That could not truthfully represent the SSOT requirement for a legal rest place, so this slice adds an optional static `location.rest = { label }` Content Pack contract. `survival.rest` now fails with `REST_NOT_AVAILABLE` when the current location does not declare rest, and Narrative exposes the rest utility only at declared locations. Fatigue relief remains the existing pack-level deterministic value; no new persistent state or timer is added.

The legacy `dev-starter` fixture explicitly declares rest at the square and well so existing Survival regression paths remain available. Its grove intentionally has no rest declaration.

## Deliberately deferred economic depth

This pack proves topology and the playable livelihood loop, not the final economy simulation. The existing Economy module still creates bounded work pay directly from the job rule and the basic market still has static offers. Finite employer budgets, NPC stock depletion, sold-out recovery, payroll solvency, and institution-backed money-source accounting remain follow-up work. They must not be disguised as already solved by Content Pack prose.

Likewise, this slice does not add final settlement canon, tutorial-village linkage, cultivation content, scheduled shifts, housing ownership, weather/terrain travel, combat, disease, or background simulation.

## Development runner

`npm run dev:first-settlement` starts the same local server with this Content Pack and a separate `.data/first-settlement-world.json`, so it cannot silently reinterpret an existing `dev-starter` save under different content IDs. Normal `npm run dev` remains on `dev-starter` for regression work.

## Cost

All new content is static versioned data. Rest validation and settlement actions are request-driven deterministic code. No AI call, database, scheduler, queue, polling, worker, external media, or paid service is introduced.
