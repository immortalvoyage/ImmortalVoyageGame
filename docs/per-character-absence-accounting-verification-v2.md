# V2 Per-Character Absence Accounting Verification

Status: PR candidate evidence for `feat/v2-per-character-absence-accounting`.

## Defect addressed

PR #89 correctly bounded shelter Survival for one global lazy-resolution gap, but the shared World Clock exposed a multiplayer correctness hole: another player's frequent successful requests could advance the global clock in many short gaps and repeatedly resolve an actually absent sheltered character, effectively bypassing the intended six-hour shelter cap.

This branch changes the accounting boundary from the latest global request gap to each active character's own last successfully committed request time.

## Executed in the connected environment

The connected container still cannot clone `github.com`, so the canonical full repository checkout command `npm run verify` was not executed here.

Targeted evidence executed against the candidate logic:

- personal Survival absence resolver: **5/5 passed**
  - 72-hour shelter absence caps to six hours;
  - 72-hour ordinary-location absence receives full pressure;
  - two successful two-hour active gaps accumulate four hours rather than receiving a permanent shelter discount;
  - fractional need progress survives the personal activity boundary exactly;
  - malformed/future personal activity clocks fail closed.
- schema v7→v8 activity migration harness: **3/3 passed**
  - missing active marker backfills to current logical time;
  - existing valid active marker is preserved;
  - archived character is not given an active-session marker.
- actor-aware GameRuntime/shared-clock semantic harness: **2/2 passed**
  - another actor advances the shared clock hourly for 72 hours without touching the absent sheltered character; a return request with a zero current global gap still resolves the full personal absence once and applies only the six-hour shelter exposure;
  - idempotent replay returns before personal elapsed resolution and does not falsely refresh the activity marker.
- syntax checks passed for the exact candidate Survival elapsed helper and its pure tests, the candidate GameRuntime flow, Character activity initialization/public stripping, Survival actor-only resolver, and the new per-character/migration test sources.

## Repository tests added or extended

- `tests/per-character-absence-accounting.test.mjs`
  - two real game actors share the same first-settlement world;
  - the active actor sends 72 hourly successful scene requests;
  - the sheltered absent actor remains untouched until return, then resolves to hunger 12 / thirst 18 / fatigue 7 including the lodging route cost;
  - an unsheltered absent actor returns at hunger 100 / thirst 100 / fatigue 72;
  - raw `lastActiveLogicalTimeSeconds` is absent from public birth/scene/location projections;
  - with Survival feature-disabled, successful requests still advance the generic server activity clock while needs remain unchanged.
- `tests/activity-clock-migration.test.mjs`
  - v7→v8 backfill and preservation.
- `tests/survival-absence.test.mjs`
  - rewritten around personal activity gaps rather than global gaps.
- `tests/game-runtime-elapsed-context.test.mjs`
  - elapsed hooks receive the requesting actor and run even when the current global elapsed gap is zero.
- `tests/world-state-invariants.test.mjs`
  - active activity clock must be a nonnegative safe integer no later than current logical world time.
- existing authoritative fixtures in runtime mutation guard, world/content compatibility, and Estate settlement were updated for schema v8; Estate explicitly verifies that the active-session clock is not copied into the death archive.

## Schema and migration semantics

World schema v8 adds one server-only integer to each active character:

`lastActiveLogicalTimeSeconds`

Birth initializes it to current shared logical time. After each successfully committed non-replayed request, GameRuntime advances it to the committed shared logical time for that owned active character.

The v7→v8 migration initializes a missing active marker to the save's current `logicalTimeSeconds`, because v7 saves had already resolved Survival through that global point under the old model. This prevents upgrade-time double charging. Archived characters do not receive the field.

## Failure / privacy boundaries

- another player's request never advances another character's activity marker;
- another player's request no longer applies another character's Survival elapsed mutation;
- failed actions still do not persist elapsed/activity mutation, preserving the existing zero-mutation failure contract;
- exact request-id replay returns the cached result before elapsed/activity handling;
- the Browser cannot submit, set, or read the raw activity marker;
- Content Pack shelter tuning remains server-only;
- permanent death, offline jobs, hazards, wages, and presence tracking remain out of scope.

## Verification limitation

These targeted harnesses are not a substitute for the repository-wide suite. Canonical completion evidence remains `npm run verify` from a real repository checkout. No GitHub Actions workflow, paid runner, or external CI service was added to work around the connected environment limitation.

## Free Resource Impact

No new persistent cost. The change stores one bounded integer per active character and performs only request-driven lazy calculation. No database, queue, scheduler, worker, polling loop, heartbeat, presence service, AI provider, or external SaaS was added.
