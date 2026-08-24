# Employment / Work Contract targeted verification

This file records the connected-environment evidence for the V2 Employment / Work Contract slice. It does not claim a full private-repository `npm run verify` rerun.

## Targeted evidence

- Employment semantic harness: 9/9 passed. Covered forged work before employment with zero mutation, public bounded contract projection, authoritative persisted current employment, request-idempotent accept/work, one-current-employment enforcement, resignation before employer switching, guessed/remote offer rejection, Employment Module-off degradation, and no raw behavior/need-cost/job ID leakage through the public contract.
- Employment + Economy contract guard harness: 8/8 passed. Covered matching contract authorization, wrong/missing contract rejection before money/behavior/need mutation, work-location binding, Survival guard coexistence, module-off removal of the employment dependency, and idempotent pay behavior.
- Schema v7 Employment migration/invariant harness: 7/7 passed. Covered v6→v7 `currentEmployment: null` backfill for active/archive characters, valid-contract preservation, malformed contract fail-closed behavior, birth with no inherited employment, historical archive preservation, and later-life zero inheritance.
- Key changed Employment sources used by the above harnesses passed `node --check` in the connected exact-source environment.

## Repository tests added or updated

Repository tests cover employer-backed Content Pack validation, public employment result formatting, end-to-end employment acceptance/resignation/work authorization, current-employment world/content compatibility, schema migration, persistence, archive/later-life behavior, Situation offer→work transition, Career/Progression compatibility, Survival Module-off behavior, Mutation Guard fixtures, and existing critical-path work updates.

## Limitation

The connected environment cannot directly clone this private repository. The canonical full check remains `npm run verify` in an environment with a real checkout. Do not describe this targeted evidence as a complete repository-suite rerun.
