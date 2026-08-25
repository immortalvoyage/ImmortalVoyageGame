# V2 Offline Shelter Survival Verification

Status: PR #89 baseline plus per-character multiplayer-correction candidate evidence on `fix/v2-per-character-absence-accounting`.

## Why the correction is required

The first #89 implementation capped each global lazy-resolution gap. In a shared world, another player's hourly requests can split one offline character's 72-hour absence into 72 one-hour global gaps. Applying a six-hour cap independently to each gap would therefore charge the offline sheltered character far beyond the intended cumulative shelter allowance.

The correction moves runtime Survival accounting to server-only per-character logical timestamps while the shared World Clock still advances normally for everyone.

## Executed in the connected environment

The connected container still cannot obtain a complete repository checkout, so full `npm run verify` and the repository integration tests are not claimed as executed end-to-end here.

Executed exact-source / exact-production-logic evidence:

- corrected `src/modules/survival/elapsed.js` + `tests/survival-absence.test.mjs`: **6/6 passed**
  - one 72-hour sheltered gap is capped to six hours of Survival exposure;
  - the same unsheltered gap receives full Survival exposure;
  - the lower-level gap helper preserves ordinary short elapsed behavior;
  - fractional `needProgressSeconds` remains exact across an interval boundary;
  - 72 separate hourly shared-world resolutions charge one offline sheltered character exactly six cumulative hours, not 72;
  - after that character's own activity resets the absence episode, the next hour is charged normally.
- exact candidate `world-state.js` + `schema-migration.js` targeted migration/invariant harness: **3/3 passed**
  - v1 reaches current schema with both activity clocks initialized;
  - v7→v8 backfills both clocks at current logical world time and preserves valid existing values;
  - invalid current activity time fails closed.
- exact candidate `GameRuntime` with current Core dependencies targeted activity harness: **1/1 passed**
  - a successful authoritative request advances private actor activity;
  - same-request idempotent replay does not advance world/activity;
  - a failed action does not persist the lazily resolved draft or activity time.
- `node --check` passed for the reconstructed exact candidate sources used above: `world-state.js`, `schema-migration.js`, `game-runtime.js`, `character/index.js`, `survival/elapsed.js`, and `survival/index.js`.
- `node --check` passed for new repository integration sources `character-activity-time.test.mjs` and `offline-shelter-multiplayer.test.mjs`.

Existing #89 first-settlement arithmetic remains applicable:

- 72 hours at the lodging after route fatigue: hunger 12 / thirst 18 / fatigue 7;
- 72 hours at the ordinary street: hunger 100 / thirst 100 / fatigue 72;
- leaving shelter and then resolving 24 hours on the street: hunger 60 / thirst 90 / fatigue 32.

## Repository tests in the correction

New/updated repository-level tests include:

- `tests/offline-shelter-multiplayer.test.mjs`
  - creates a sheltered player plus another active player;
  - advances the shared world through 72 hourly requests made only by the other player;
  - requires the sheltered player to remain at six cumulative hours of Survival exposure;
  - requires the active unsheltered player to receive ordinary full pressure;
  - verifies the sheltered player's own later successful request resets the absence episode;
  - verifies private activity timestamps do not leak in the public scene.
- `tests/character-activity-time.test.mjs`
  - successful actor requests update private logical activity;
  - idempotent replay does not advance activity or world time;
  - failed actions do not persist activity/time changes.
- `tests/schema-migration.test.mjs`
  - v7→v8 backfills active character activity clocks at current logical world time;
  - valid preexisting values are preserved;
  - invalid activity time fails structural validation.
- `tests/world-state-invariants.test.mjs`, `tests/world-content-compatibility.test.mjs`, `tests/runtime-mutation-guard.test.mjs`, `tests/estate-settlement.test.mjs`, and `tests/persistence.test.mjs` are updated for the schema-v8 active-character contract and privacy/archive semantics.

Existing #89 tests remain in place for one-gap shelter behavior, Content Pack validation, server-owned elapsed context, public privacy, ordinary-location pressure, and leaving-shelter behavior.

## Schema / authority verification target

World schema v8 adds only two bounded server-side integers to active characters:

- `lastActiveLogicalTimeSeconds`
- `lastSurvivalResolvedLogicalTimeSeconds`

Both must be within `[0, world.logicalTimeSeconds]`. They are initialized at birth, backfilled on v7 migration, hidden from `publicCharacter`, and not copied into archived deceased-character state or Estate assets.

No Browser input can set either timestamp. `GameRuntime` records generic actor activity only after a successful authoritative action has resolved. Survival alone interprets those timestamps together with the server-owned shelter Content Pack rule.

## Verification limitation

Canonical repository-wide completion evidence remains `npm run verify` from a real checkout. The connected-environment targeted harnesses above are not represented as a full repository suite pass. No GitHub Actions workflow was added or invoked to bypass this limitation.

## Free Resource Impact

No new persistent cost. The correction adds only two small integers per active character. No database, queue, scheduler, worker, presence service, polling, heartbeat, AI provider, external storage, or paid service is introduced.
