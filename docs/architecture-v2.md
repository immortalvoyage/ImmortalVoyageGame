# V2 Architecture Notes

This rewrite keeps the authoritative game runtime on the server side and treats browser output as untrusted presentation/input only.

## Current boundaries

- Core: world clock, world state, action resolution, schema migration, module manifest validation, permission boundary, bounded idempotency/event ledgers.
- Modules: character, inventory, location, NPC, purpose action, survival, economy, crafting, career, narrative.
- Content: disposable versioned starter content used only to prove the critical path and small post-loop modules. Game wiring validates one server-owned Content Pack before gameplay consumes it.
- Browser: submits intents through `/api/action`; it does not import Core modules or own world truth.
- Local dev server: zero-dependency Node server with local file-backed world persistence for development only.

## Content Pack boundary

Gameplay content stays server-side and versioned. The current starter pack owns the starting location, locations/routes, NPC placement, items, jobs, market offers, gatherables, crafting recipes, career rules, and their deterministic tuning values. A deterministic validator rejects broken route/NPC/item/recipe/behavior references, duplicate local rules, free recipes with no inputs, empty career requirements, unknown need keys, invalid thresholds/quantities/prices/rewards, and a missing starting location before the pack is accepted by game wiring.

`src/game.js` is the composition boundary: it validates the selected Content Pack and injects it into the authoritative runtime context. `GameRuntime` remains content-agnostic and only forwards server-owned runtime context to registered action handlers. Gameplay modules do not import the development starter pack directly; Character, Location, NPC, Purpose, Survival, Economy, Crafting, Career, and Narrative all consume the injected pack. This makes a future validated Content Pack replaceable without editing gameplay modules or creating a second registry.

The default development wiring still selects `devStarterPack`, while tests or future server wiring may supply another validated pack. There is no remote content fetch, hot reload service, database, scheduler, polling loop, AI call, or other runtime dependency associated with this injection boundary.

### Persisted world compatibility

A Content Pack that is internally valid can still be incompatible with an existing authoritative save. After supported world-schema migration and before idempotent replay or elapsed/action resolution, game wiring runs a deterministic world/content compatibility assertion. Current character locations must still exist in the injected pack, and authoritative inventory stacks must reference existing item templates with positive safe-integer quantities.

Historical event evidence is intentionally not revalidated against current catalogs: old events may legitimately reference retired locations/items and remain historical records. By contrast, current authoritative references may not silently become orphans. A mismatch fails closed and does not rewrite the save. This guard does not guess replacement IDs, discard inventory, teleport characters, or perform automatic content migration; intentional content removal therefore requires an explicit data/content migration decision.

`GameRuntime` only owns a generic post-migration `validateLoadedWorld` callback. The Content Pack-specific compatibility logic remains under `src/content/` and is wired by `src/game.js`, so Core does not become a second content registry.

## Career and behavior

Characters do not choose a fixed profession at birth. Authoritative actions may record compact aggregate behavior counts; the current minimal work action increments a Content-Pack-defined behavior ID only after a valid job is adjudicated. Request idempotency prevents retries from increasing the count twice, and rejected actions do not mutate it.

Career identities are derived from those authoritative behavior counts plus Content Pack requirements. The derived identity is not stored as duplicate permanent state: Career recomputes the currently satisfied public identities when observed. Raw behavior IDs and counts stay server-side and are stripped from the public character view. Disabling the Career Module hides derived identities without disabling work or Core gameplay.

World schema v3 adds `behaviorCounts` and migrates v2 saves by backfilling an empty map while preserving any valid existing counts. Invalid behavior counters fail closed during world validation.

## Crafting

The minimal Crafting Module accepts a recipe intent only when that recipe exists at the character's authoritative current location. It verifies all required stackable inputs before consuming anything, then atomically removes inputs and adds the validated output on the Action Resolver draft. Missing materials or an unavailable recipe produce no committed mutation. Successful crafting emits bounded `crafting.completed` evidence, and generic request idempotency prevents retry-driven duplicate production.

Crafting recipes and ingredient/output quantities live in the Content Pack. Narrative exposes crafting as deterministic functional UI only when the module action is registered; disabling the Crafting Module therefore removes its UI without breaking Core or other gameplay.

## Purpose actions

Purpose actions express intent rather than a destination claim. The current minimal NPC-search flow lets the server inspect the authoritative NPC location and route graph, resolve at most one valid travel step, and return only the player's resulting location plus public target identity. The browser never receives the NPC's hidden authoritative location or a full path, and the action remains subject to normal server validation and feature/module availability.

## World schema

Persisted world state carries an explicit schema version. The runtime migrates supported older schemas deterministically before authoritative adjudication and rejects unknown newer schemas rather than silently resetting or guessing. Schema v2 backfills stable character sequencing and survival fractional progress from legacy v1 saves; schema v3 adds authoritative behavior-count aggregates used by derived career rules.

## Cost model

No background worker, polling loop, database, AI provider, queue, analytics service, or production deployment is required for the current slice. World progression uses logical time plus lazy elapsed resolution on the next authoritative request.

## Deferred production adapters

Production persistence, real authentication/session, production serverless adapter, migrations beyond the currently implemented schema path, and platform-level Event Bus/Registry/Feature Flag contracts remain intentionally deferred until their concrete integration is required.
