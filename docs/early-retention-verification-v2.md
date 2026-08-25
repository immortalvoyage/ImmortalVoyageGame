# V2 Early Retention / First-Session Verification

Status: PR #92–#94 merged baseline plus `fix/v2-dev-static-imports` candidate evidence.

## Goal

Verify the first-settlement candidate against the current Early Retention product gate without expanding World Core or inventing a new tutorial system.

This slice checks five things that can be verified deterministically now:

1. a new Life receives several understandable world choices immediately after birth and one ordinary choice can create a visible consequence on the next scene;
2. the mobile-first character card does not front-load empty future-system fields before the player has formed those parts of the Life;
3. the trade surface does not occupy the first-session screen when there is nothing the player can sell and no listing to inspect;
4. the secondary `可執行行動` area only projects crafting and market-buy controls that authoritative current state can actually perform;
5. the local first-settlement dev server actually serves every direct Browser module imported by `public/app.js`, so the human playtest entrypoint is runnable rather than failing on missing static modules.

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

PR #93 followed the same rule for Trade. The Trade module still returns its complete public view, but the Browser keeps the panel hidden while both `sellables` and `listings` are empty. It reappears automatically once trading becomes relevant. Trade authority and server validation are unchanged.

A further source review found two inconsistencies inside server-shaped `utilities`: crafting recipes were projected even without all required inputs, and market purchase buttons were projected even when the character could not afford them. Both direct actions already failed closed authoritatively, but showing those controls under `可執行行動` made the first-session UI invite guaranteed failures.

PR #94 kept feasibility on the server. Narrative utility projection checks authoritative inventory before publishing a crafting control and authoritative money before publishing a market-buy control. Browser logic does not infer feasibility, and forged direct actions are still revalidated by Crafting / Economy modules.

The next Critical Path review found a separate runnable-entrypoint blocker: `public/app.js` imports `character-summary.js` and `trade-visibility.js`, but `dev/server.mjs` did not expose either path in its static-file map. The Browser therefore received 404 responses for modules introduced by PR #92/#93 when launched through the documented local dev server. `fix/v2-dev-static-imports` adds both modules and a contract test that fetches `/app.js`, discovers every direct relative module import, and verifies each is served as JavaScript. This is a dev/runtime delivery fix only; world rules and Browser authority are unchanged.

## First-session structural proxy

`tests/early-retention-first-session.test.mjs` follows the current first-settlement deterministic path:

- birth;
- first scene exposes <= 4 main world opportunities and includes social interaction, employment, and movement;
- talking to the foreman creates visible familiarity on the next scene;
- the newly unlocked topic can grant the basic-living knowledge fact;
- accepting work and performing one work action creates money plus survival tradeoffs;
- the earned money buys food and water;
- consuming both restores hunger/thirst while employment, relationship, and learned knowledge remain visible.

`tests/narrative-utility-actionability.test.mjs` adds a focused control-projection proxy:

- a zero-money / zero-inventory new Life sees neither buy nor craft utilities;
- after one legal work action earns 2 money, both market purchase controls appear while crafting remains hidden;
- after buying bread and water, money returns to 0, buy controls disappear, and the now-feasible ration recipe appears.

`tests/dev-server-static-assets.test.mjs` adds a runnable-entrypoint contract:

- fetch the actual `/app.js` from `createDevServer`;
- discover its direct `./*.js` imports;
- require every imported Browser module to return HTTP 200 with a JavaScript content type.

These are machine-verifiable Critical Path proxies, not claims that a human completes the flow within a specific wall-clock duration.

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
- `src/modules/narrative/utility-availability.js` syntax check: passed;
- pure utility feasibility semantic harness: **2/2 passed**;
  - crafting requires every recipe input in authoritative inventory;
  - buying requires authoritative money >= offer price.
- `tests/early-retention-first-session.test.mjs` source syntax check: passed.
- `tests/narrative-utility-actionability.test.mjs` source syntax check: passed.
- `dev/server.mjs` candidate source syntax check: passed.
- `tests/dev-server-static-assets.test.mjs` candidate source syntax check: passed.
- reconstructed HTTP static-serving fixture using the candidate dev-server source and direct `app.js` imports: **1/1 passed**.

The repository integration tests are committed for execution by the canonical `npm run verify` suite when a complete checkout is available; they are not represented here as executed end-to-end.

## Remaining validation gap

The deterministic source review no longer shows an obvious first-screen guaranteed-failure control or local dev-server module-delivery blocker in the core first-settlement loop. The remaining Early Retention gate is primarily a real human/mobile playtest question: whether the wording, visual hierarchy, decision density, perceived pace, and NPC/place emotional hook actually achieve the intended first-choice / visible-consequence / 10–15 minute experience. That cannot be proven by server tests alone.

## Boundaries

- no schema or migration change;
- no Content Pack tuning change;
- no new gameplay Module or World Engine rule;
- no new AI call, analytics provider, timer, scheduler, heartbeat, polling, background worker, or external service;
- no FOMO, daily-login reward, forced tutorial, or login punishment;
- no change to Action Resolver, World Engine authority, Knowledge boundaries, or hidden information policy;
- no attempt to solve action duration / `busyUntil` in this slice.

## Free Resource Impact

No new persistent cost. The dev-server change only serves two existing local static Browser modules and adds repository verification.
