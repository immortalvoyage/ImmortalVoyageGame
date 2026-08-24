# PR #85 candidate summary

Purpose: make livelihood work an employer-backed authoritative contract instead of a free-standing repeatable button while preserving module-off graceful degradation.

Changes: world schema v7 `currentEmployment`; Employment Module accept/resign/observe; Content Pack job title + employer binding; Economy contract guard; Situation/Narrative offer→work flow; public current-employment projection; archive preservation and next-life zero inheritance; fail-closed active world/content compatibility; deterministic player-facing result messages.

Verification: Employment semantic 9/9, Employment+Economy guard 8/8, schema v7 migration/invariant 7/7, key exact-source syntax checks passed. Full private-repo `npm run verify` was not rerun in the connected environment.

Risk/rollback: additive schema migration only. Active employment references intentionally become Content Pack migration gates. Feature-disabling Employment removes the contract dependency from work. Rollback after v7 state exists requires a schema-aware rollback rather than running an older v6 runtime against newer saves.

Cost: no AI, DB, scheduler, queue, polling, worker, or external service added.
