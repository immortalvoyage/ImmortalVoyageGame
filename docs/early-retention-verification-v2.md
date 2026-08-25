# V2 Early Retention / First-Session Verification

Status: PR #92 merged baseline plus `fix/v2-first-session-actionability` candidate evidence.

## Goal

Verify the first-settlement candidate against the current Early Retention product gate without expanding World Core or inventing a new tutorial system.

This slice checks three things that can be verified deterministically now:

1. a new Life receives several understandable world choices immediately after birth and one ordinary choice can create a visible consequence on the next scene;
2. the mobile-first character card does not front-load empty future-system fields before the player has formed those parts of the Life;
3. the trade surface does not occupy the first-session screen when there is nothing the player can sell and no listing to inspect.

Human timing targets such as First Meaningful Choice <= 90 seconds, Visible Consequence <= 3 minutes, and a 10–15 minute micro-loop still require an actual play session. Automated tests are treated only as structural proxies and do not claim those human timing thresholds have been met.

## Source-review findings

Before PR #92, a brand-new character card rendered six future-state placeholders even when nothing had formed yet:

- 身分：尚未形成
- 現職：尚無
- 技能：尚未形成
- 社會標籤：尚未形成
- 關係：尚未形成
- 已知情報：尚無

Together with the six immediately useful rows (姓名、貨幣、飢餓、口渴、疲勞、背包), this made the first mobile screen explain systems the player had not touched yet.

PR #92 changed the Browser to progressive disclosure. New players see only the six core rows. Career, employment, skills, social tags, relationships, and knowledge appear only after authoritative server state says they have actually formed. This is a presentation-only change: Browser authority is unchanged and no client-derived world truth is introduced.

Follow-up source review found the empty Trade panel had the same problem: the Trade module returns a valid public view even when both `sellables` and `listings` are empty, so a new player saw an irrelevant disabled marketplace form before owning anything. The actionability follow-up keeps that panel hidden until at least one sellable item or public listing exists. Trade authority and server validation are unchanged.

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
- `public/trade-visibility.js` syntax check: passed;
- pure `shouldShowTradePanel` semantic harness: **2/2 passed**;
  - null or empty Trade state stays hidden;
  - Trade appears when either a sellable item or a public listing exists.
- `tests/early-retention-first-session.test.mjs` source syntax check: passed.

The repository integration test itself is committed for execution by the canonical `npm run verify` suite when a complete checkout is available; it is not represented here as executed end-to-end.

## Remaining source-review risk

The secondary `可執行行動` area can still expose deterministic controls that will currently fail, especially crafting without required materials and market purchase with insufficient funds. That is the next candidate Early Retention/actionability issue, but it is not changed in this Browser-only follow-up because feasibility should be shaped server-side rather than guessed by the Browser.

## Boundaries

- no schema or migration change;
- no Content Pack tuning change;
- no new AI call, analytics provider, timer, scheduler, heartbeat, polling, background worker, or external service;
- no FOMO, daily-login reward, forced tutorial, or login punishment;
- no change to Action Resolver, World Engine authority, Knowledge boundaries, or hidden information policy;
- no attempt to solve action duration / `busyUntil` in this slice.

## Free Resource Impact

No new persistent cost. These progressive-disclosure helpers are static Browser code and verification is repository test/documentation only.
