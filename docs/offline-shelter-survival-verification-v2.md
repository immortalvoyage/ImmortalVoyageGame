# V2 Offline Shelter Survival Verification

Status: PR candidate evidence for `feat/v2-offline-shelter-survival`.

## Executed in the connected environment

The connected container still cannot obtain a complete repository checkout, so the full `npm run verify` suite and the new repository integration tests were not executed end-to-end here.

Executed exact-source evidence:

- standalone `src/modules/survival/elapsed.js` + `tests/survival-absence.test.mjs`: **4/4 passed**
  - 72-hour sheltered gap is capped to six hours of Survival exposure;
  - the same unsheltered gap receives full Survival exposure;
  - repeated short sheltered gaps accumulate normally rather than receiving a permanent rate discount;
  - fractional `needProgressSeconds` remains exact across a need interval boundary.
- `node --check` for the exact standalone elapsed resolver and pure test: **passed**.
- first-settlement absence arithmetic: **3/3 passed**
  - 72 hours at the lodging after the route fatigue cost resolves to hunger 12 / thirst 18 / fatigue 7;
  - 72 hours at the street resolves to hunger 100 / thirst 100 / fatigue 72;
  - leaving the sheltered state and then resolving 24 hours at the street reaches hunger 60 / thirst 90 / fatigue 32, proving protection is location-bound.

## Repository tests added

- `tests/survival-absence.test.mjs`
- `tests/offline-shelter-survival.test.mjs`
- `tests/offline-shelter-content-pack.test.mjs`
- `tests/game-runtime-elapsed-context.test.mjs`

The integration tests require:

- full shared logical time still advances by the complete 72 hours;
- only Survival exposure is capped at a valid shelter;
- the shelter cap is not leaked in the public Narrative scene;
- ordinary locations preserve current full elapsed pressure;
- protection stops after leaving the lodging;
- malformed, unbounded, or non-rest shelter declarations fail Content Pack validation;
- elapsed modules receive server-owned runtime context without moving Content Pack semantics into Core.

## Verification limitation

Canonical completion evidence remains `npm run verify` in a real repository checkout. The targeted harnesses above are not represented as a repository-wide suite pass.

## Free Resource Impact

No new persistent cost. No schema migration, database, queue, scheduler, worker, presence service, polling, heartbeat, AI provider, external storage, or paid service was introduced.
