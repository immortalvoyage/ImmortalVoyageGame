# V2 verification

## Canonical local check

Run:

```bash
npm run verify
```

The verification runner uses only Node.js built-ins. It performs `node --check` over JavaScript/MJS files in `src/`, `dev/`, `public/`, `tests/`, and `scripts/`, then runs the complete `node --test` suite. This is the preferred local completion check before claiming a future branch fully verified.

## Evidence history

- PR #60: last complete repository suite executed in the available development environment — 16 tests passed and all JavaScript/MJS syntax checks passed.
- PR #61: exact-source targeted schema migration harness — 7/7 passed; changed core files passed `node --check`.
- PR #62: exact-source targeted Purpose Action harness — 3/3 passed; Location/Purpose/Narrative passed `node --check`.
- PR #63: exact-source deterministic result-message tests — 4/4 passed; `public/result-message.js` passed `node --check`.
- PR #64: added zero-dependency `npm run verify`; exact runner logic completed syntax checks plus a full isolated fixture test run.
- PR #65: Purpose arrival semantic harness — 4/4 passed; Purpose module passed `node --check`.
- PR #66: player-facing failure formatter semantic harness — 3/3 passed; formatter passed `node --check`.
- PR #67: inventory public-view semantic harness — 3/3 passed; Inventory/Narrative changed files passed `node --check`.
- PR #68: Content Pack validation + Character semantic harness — 10/10 passed; relevant files passed `node --check`.
- PR #69: Crafting/Content/Narrative/UI semantic harness — 7/7 passed; authoritative GameRuntime idempotency harness — 5/5 passed; relevant files passed `node --check`.
- PR #70: authoritative Career behavior/migration/idempotency semantic harness — 10/10 passed; relevant changed files passed `node --check`.
- PR #71: isolated exact-source cross-module Content Pack injection semantic harness passed; exact-source GameRuntime runtime-context harness — 4/4 passed; exact-source `src/game.js` wiring harness — 6/6 passed; changed gameplay modules, GameRuntime, game wiring, and the new injection test passed `node --check`.
- PR #72: exact-source world/content compatibility validator harness — 5/5 passed; exact-source GameRuntime validation-order harness — 4/4 passed; validator, GameRuntime, game wiring, and new compatibility test syntax checks passed.
- PR #73: exact-source authoritative world-state invariant harness — 9/9 passed; legacy v1→v3 migration compatibility harness passed; `world-state.js` and new invariant test syntax checks passed.
- PR #74 candidate: exact-source Progression projection/permission/shared behavior-writer harness — 6/6 passed; isolated work/gather/craft success/failure behavior semantic harness — 6/6 passed; fetched behavior/progression/economy/survival/crafting module sources used by the harness passed `node --check`. Repository tests add end-to-end coverage for derived social/skill tags, successful crafting unlock, retry idempotency, failed-craft zero mutation, Progression Module-off degradation, behavior-counter saturation, and invalid progression Content Pack rules.

The connected execution environment cannot directly clone this private repository, so targeted evidence after PR #60 must not be presented as a full repository-suite rerun. A future environment with the repository checked out should use `npm run verify` and record that result.

## Coverage areas already represented

Coverage includes the critical playable loop, invalid movement, unauthenticated access, idempotent retries, request-id collision isolation, module-off degradation, lazy elapsed world resolution, fractional survival progress, bounded idempotency storage, economy source/sink evidence, local persistence and corruption fail-closed behavior, schema migration, Purpose Action privacy/boundary behavior, server/browser separation, deterministic player-facing result feedback, Content Pack validation, public inventory projection, Crafting atomicity/duplicate-production protection, behavior-derived Career progression, replaceable server-side Content Pack injection without direct Gameplay Module dependency on development content, fail-closed current-world compatibility checks for orphaned location/item references after Content Pack replacement, structural authoritative-state invariants for ownership/survival/money/inventory/world time/bounded ledgers, and deterministic skill/social-tag derivation from compact authoritative work/gather/craft behavior without persisting duplicate tag state or exposing raw behavior counters.
