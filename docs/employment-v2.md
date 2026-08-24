# Employment / Work Contract V2

This slice adds a minimal deterministic employer-backed work contract without introducing realtime shifts, background payroll, AI adjudication, or a second career system.

## Boundary

`Employment` is authoritative current-state, while `Career` remains a derived identity from behavior. A character may have at most one `currentEmployment` at a time. The stored contract contains only the server-side job ID, employer NPC ID, and work location ID. Public projections expose bounded human-readable contract details such as job title, employer name, workplace name, and wage per completed work action; raw behavior IDs and need-cost tuning remain server-side.

Jobs remain Content-Pack data. In this minimal stationary-job slice, every job must declare a public title and an `employerNpcId`, and that employer NPC must exist at the job's work location. Accepting a guessed or remote offer fails before mutation. An active contract is revalidated against the active Content Pack, so removing its work location, job, or employer requires an explicit content/data migration rather than silently orphaning authoritative state.

## Authoritative work flow

When the Employment Module is enabled, `economy.work` requires the character's current employment to match the requested job, employer, and work location. Directly forging a work action before accepting employment returns `EMPLOYMENT_REQUIRED` without money, behavior, or survival-cost mutation. Existing Survival critical-condition guards still run independently after employment authorization.

Employment acceptance and resignation are request-idempotent through the existing Action Resolver ledger. A character cannot silently switch employers while already employed; resignation must end the current contract before another offer can be accepted. Situation/Narrative project an employer offer while unemployed and a work opportunity after the matching contract exists. Resignation stays a deterministic utility rather than occupying one of the bounded primary opportunities.

Disabling the Employment Module removes employment projection and contract actions, and deliberately removes the employment dependency from `economy.work`. This preserves module replaceability and avoids leaving persisted employment state as a hidden lock on the older critical-path work flow.

## Persistence, death, and later lives

World schema v7 adds `currentEmployment` to active and archived characters. The v6→v7 migration backfills `null` and preserves already-valid contracts. `publicCharacter` strips the raw stored contract.

Death settlement preserves the deceased character's final employment contract in the historical archive, but employment is not an Estate asset. A newly born later life starts with `currentEmployment: null`; no employer relationship, job entitlement, or wage is inherited automatically.

## Deferred scope

This is not yet the full occupation-duty system described by the game SSOT. Scheduled shifts, attendance, absence policy, housing/meal policy, employer budget/payroll solvency, dismissal, leave, promotion, player employers, workplace relocation, contracts with duration/deadlines, labor law, and offline occupation duty remain deferred. Those later rules must remain deterministic and event/lazy-driven, and must not require a per-character polling worker.

## Cost

No new database, scheduler, queue, worker, AI call, polling loop, external service, or production resource is introduced. All checks and mutations occur on existing authoritative player requests.
