# V2 Architecture Notes

This rewrite keeps the authoritative game runtime on the server side and treats browser output as untrusted presentation/input only.

## Current boundaries

- Core: world clock, world state, action resolution, schema migration, module manifest validation, permission boundary, bounded idempotency/event ledgers.
- Modules: character, inventory, location, NPC, purpose action, survival, economy, narrative.
- Content: disposable versioned starter content used only to prove the critical path. Server startup validates its references and bounded numeric rules before gameplay code consumes it.
- Browser: submits intents through `/api/action`; it does not import Core modules or own world truth.
- Local dev server: zero-dependency Node server with local file-backed world persistence for development only.

## Content Pack boundary

Gameplay content stays server-side and versioned. The current starter pack owns the starting location, locations/routes, NPC placement, items, jobs, market offers, gatherables, and their deterministic tuning values. A deterministic validator rejects broken route/NPC/item references, duplicate local rules, unknown need keys, invalid quantities/prices/rewards, and a missing starting location at module load time. Character birth reads the Content Pack starting location rather than hardcoding a starter-world ID.

This validation is a fail-closed development/runtime guard, not a second source of world truth and not a remote content service. It adds no database, scheduler, polling, AI, or network dependency.

## Purpose actions

Purpose actions express intent rather than a destination claim. The current minimal NPC-search flow lets the server inspect the authoritative NPC location and route graph, resolve at most one valid travel step, and return only the player's resulting location plus public target identity. The browser never receives the NPC's hidden authoritative location or a full path, and the action remains subject to normal server validation and feature/module availability.

## World schema

Persisted world state carries an explicit schema version. The runtime migrates supported older schemas deterministically before authoritative adjudication and rejects unknown newer schemas rather than silently resetting or guessing. Schema v2 backfills stable character sequencing and survival fractional progress from legacy v1 saves.

## Cost model

No background worker, polling loop, database, AI provider, queue, analytics service, or production deployment is required for the current slice. World progression uses logical time plus lazy elapsed resolution on the next authoritative request.

## Deferred production adapters

Production persistence, real authentication/session, production serverless adapter, migrations beyond the currently implemented schema path, and platform-level Event Bus/Registry/Feature Flag contracts remain intentionally deferred until their concrete integration is required.
