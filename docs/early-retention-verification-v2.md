# V2 Early Retention / First-Session Verification

Status: candidate evidence for `feat/v2-early-retention-progressive-disclosure`.

## Goal

Verify the first-settlement candidate against the current Early Retention product gate without expanding World Core or inventing a new tutorial system.

This slice checks two things that can be verified deterministically now:

1. a new Life receives several understandable world choices immediately after birth and one ordinary choice can create a visible consequence on the next scene;
2. the mobile-first character card does not front-load empty future-system fields before the player has formed those parts of the Life.

Human timing targets such as First Meaningful Choice <= 90 seconds, Visible Consequence <= 3 minutes, and a 10–15 minute micro-loop still require an actual play session. Automated tests are treated only as structural proxies and do not claim those human timing thresholds have been met.

## Source-review finding

Before this change, a brand-new character card rendered six future-state placeholders even when nothing had formed yet:

- 身分：尚未形成
- 現職：尚無
- 技能：尚未形成
- 社會標籤：尚未形成
- 關係：尚未形成
- 已知情報：尚無

Together with the six immediately useful rows (姓名、貨幣、飢餓、口渴、疲勞、背包), this made the first mobile screen explain systems the player had not touched yet.

The Browser now uses progressive disclosure. New players see only the six core rows. Career, employment, skills, social tags, relationships, and knowledge appear only after authoritative server state says they have actually formed. This is a presentation-only change: Browser authority is unchanged and no client-derived world truth is introduced.

## First-session structural proxy

`tests/early-retention-first-session.test.mjs` follows the current first-settlement deterministic path:

- birth;
- first scene exposes <= 4 main world opportunities and includes social interaction, employment, and movement;
- talking to the foreman creates visible familiarity on the next scene;
- the newly unlocked topic can grant the basic-living knowledge fact;
- accepting work and performing one work action creates money plus survival tradeoffs;
- the earned money buys food and water;
- consuming both restores hunger/thirst while employment, relationship, and learned knowledge remain visible.

This is a machine-verifiable Critical Path proxy, not a claim that a human completes it within a specific wall-clock duration.

## Executed evidence in the connected environment

The connected environment still cannot obtain a complete repository checkout, so full `npm run verify` is not claimed.

Executed reconstructed exact-source evidence:

- `public/character-summary.js` syntax check: passed;
- pure `buildCharacterSummaryRows` semantic harness: **2/2 passed**;
  - a brand-new character renders exactly the six core rows and no empty future-system placeholders;
  - already formed career/employment/progression/relationship/knowledge state appears progressively with the expected public text.
- `tests/early-retention-first-session.test.mjs` source syntax check: passed.

The repository integration test itself is committed for execution by the canonical `npm run verify` suite when a complete checkout is available; it is not represented here as executed end-to-end.

## Boundaries

- no schema or migration change;
- no Content Pack tuning change;
- no new AI call, analytics provider, timer, scheduler, heartbeat, polling, background worker, or external service;
- no FOMO, daily-login reward, forced tutorial, or login punishment;
- no change to Action Resolver, World Engine authority, Knowledge boundaries, or hidden information policy;
- no attempt to solve action duration / `busyUntil` in this slice.

## Free Resource Impact

No new persistent cost. The progressive disclosure helper is static Browser code and the new verification is repository test/documentation only.
