# V2 Architecture Notes

This rewrite keeps the authoritative game runtime on the server side and treats browser output as untrusted presentation/input only.

## Current boundaries

- Core: world clock, world state, action resolution, schema migration, module manifest validation, permission boundary, bounded idempotency/event/trade state, archived-character/estate structural invariants.
- Modules: character, inventory, location, NPC, purpose action, survival, economy, trade, crafting, progression, career, relationship, estate, narrative.
- Content: disposable versioned starter content used only to prove the critical path and small post-loop modules. Game wiring validates one server-owned Content Pack before gameplay consumes it.
- Browser: submits intents through `/api/action`; it does not import Core modules or own world truth.
- Local dev server: zero-dependency Node server with local file-backed world persistence for development only.

## Content Pack boundary

Gameplay content stays server-side and versioned. The current starter pack owns the starting location, locations/routes, NPC placement, items, jobs, market offers, gatherables, crafting recipes, progression tags, career rules, optional NPC familiarity rules, survival warning/critical thresholds, basic rest relief, and their deterministic tuning values. A deterministic validator rejects broken route/NPC/item/recipe/behavior references, invalid progression kinds or thresholds, invalid or reversed survival thresholds, invalid rest relief, malformed or colliding NPC relationship behavior IDs, unordered/duplicate familiarity levels, duplicate local rules, free recipes with no inputs, empty behavior requirements, unknown need keys, invalid quantities/prices/rewards, and a missing starting location before the pack is accepted by game wiring.

`src/game.js` is the composition boundary: it validates the selected Content Pack and injects it into the authoritative runtime context. `GameRuntime` remains content-agnostic and only forwards server-owned runtime context to registered action handlers. Gameplay modules do not import the development starter pack directly; modules that need current content consume the injected pack. This makes a future validated Content Pack replaceable without editing gameplay modules or creating a second registry.

The default development wiring still selects `devStarterPack`, while tests or future server wiring may supply another validated pack. There is no remote content fetch, hot reload service, database, scheduler, polling loop, AI call, or other runtime dependency associated with this injection boundary.

### Persisted world compatibility

A Content Pack that is internally valid can still be incompatible with an existing authoritative save. After supported world-schema migration and before idempotent replay or elapsed/action resolution, game wiring runs a deterministic world/content compatibility assertion. Current character locations and inventory stacks must reference active content. Trade escrow stacks and unresolved Estate inventory are also current authoritative assets, so their item templates must still exist in the active Content Pack.

Historical event evidence and archived-character locations are intentionally not revalidated against current catalogs: old events or death locations may legitimately reference retired locations/items and remain historical records. By contrast, assets that may still be distributed or consumed may not silently become orphans. A mismatch fails closed and does not rewrite the save. This guard does not guess replacement IDs, discard inventory, teleport characters, or perform automatic content migration; intentional content removal therefore requires an explicit data/content migration decision.

`GameRuntime` owns only a generic `validateLoadedWorld` callback. The Content Pack-specific compatibility logic remains under `src/content/` and is wired by `src/game.js`, so Core does not become a second content registry.

## Authoritative mutation and world-state invariants

After supported schema migration, Core validates the structural invariants that every current save must satisfy before gameplay or cached replay can proceed. This includes world identity/time, active character ownership and identity, bounded 0–100 survival needs, nonnegative survival progress and behavior counters, stack inventory quantities, nonnegative integer money, bounded trade listings, paired archived-character/Estate records, nonduplicated Estate assets, and internal consistency/size limits for request-result and game-event ledgers.

Successful action drafts are validated a second time immediately before persistence, after bounded event/request evidence is recorded. Both structural validation and the injected domain/content validator must pass. A handler therefore cannot return `ok: true` and silently persist malformed or orphaned authoritative state. Validation failure leaves the store unchanged.

These checks are validation only: malformed state is rejected instead of silently repaired. Existing writer functions remain responsible for trimming request/event ledgers to their 256-entry caps. Content-specific references remain outside Core and are checked separately by the world/content compatibility guard.

## Survival condition and reversible pressure

Survival needs remain authoritative numeric state and continue to advance by logical elapsed time when the Survival Module is enabled. The current starter Content Pack defines a warning threshold and a higher critical threshold. A public condition projection is derived from current hunger, thirst, and fatigue; the thresholds themselves are server/content tuning and are not copied into persistent character state.

Warning is informational only. At critical condition, `economy.work` is rejected before reward, behavior, or need-cost mutation. Narrative also hides work choices and tells the player to address the affected needs, but this presentation behavior is not the security boundary: a forged work request is still rejected server-side.

The guard deliberately preserves recovery paths. Hunger can be reduced by gathered or purchased food, thirst by gathered or purchased water, and fatigue by the minimal deterministic `survival.rest` action. Travel, gathering, consuming supplies, purchasing supplies, and rest are not blocked by the critical work guard. The development map keeps basic water and food reachable from the starter square so a player without money still has a recovery route.

Basic rest is request-driven and only decreases fatigue by a validated Content-Pack amount; it creates no item, money, background timer, lodging state, or world-time jump. Richer sleep, accommodation, temperature, encumbrance, offline activity, illness, and environmental exposure remain later modules/rules rather than being approximated here.

The Survival Module can still be disabled. Economy checks runtime action availability before applying the survival work guard, so disabling Survival does not leave stale need values as a hidden dependency that can permanently block work. Narrative likewise omits the public condition and rest utility when Survival actions are unavailable.

This slice is intentionally **not a death trigger**. Reaching warning or critical need levels does not call Estate settlement and does not permanently kill a character. Permanent death requires a separately approved authoritative hazard/death rule with explicit warning and relief semantics.

## Behavior, progression, career, and relationships

Characters do not choose a fixed profession at birth. Successful authoritative work, gather, craft, and configured NPC-interaction actions may record compact Content-Pack-defined behavior counts. Rejected actions do not record behavior, request idempotency prevents retries from incrementing a behavior twice, and the shared behavior writer saturates at `Number.MAX_SAFE_INTEGER` instead of overflowing persisted counters.

The Progression Module derives public skill/social tags from those authoritative behavior counts plus Content Pack requirements. Derived tags are not persisted as duplicate state and expose only public names; raw behavior IDs, thresholds, and counters remain server-side. Disabling the Progression Module hides these derived tags without disabling work, gathering, crafting, or Core gameplay.

Career identities use the same authoritative behavior source but remain a separate module and a higher-order derived identity. Career identity is likewise not stored as duplicate permanent state: Career recomputes the currently satisfied public identities when observed. Disabling the Career Module hides derived identities without disabling the underlying actions.

The Relationship Module follows the same pattern for NPC familiarity. A configured NPC interaction records a unique server-only behavior ID only after authoritative ownership/location checks pass. Familiarity levels live in the Content Pack with strictly increasing interaction-count thresholds. Relationship observation returns only NPC public identity plus the highest satisfied familiarity name; it does not expose the raw behavior ID, count, or thresholds, and NPCs with no satisfied familiarity level are not added to the relationship list. This prevents the module from revealing otherwise unknown NPCs merely because they exist in server content.

Relationship is derived state, not a second persisted relationship table. Turning the Relationship Module off hides the projection but does not disable NPC interaction or erase its authoritative behavior evidence. Because a newly born character starts with empty `behaviorCounts`, a later life does not automatically inherit the prior character's familiarity. A deceased character's archived behavior aggregates remain historical evidence tied to that archived character.

NPC relationship behavior IDs must not collide with other authoritative behavior sources. This avoids one NPC interaction accidentally advancing another NPC or a work/gather/craft action advancing familiarity. Once declared, an NPC interaction behavior may be referenced by other Content-Pack-derived rules such as a future social tag or career condition.

World schema v3 adds `behaviorCounts` and migrates v2 saves by backfilling an empty map while preserving any valid existing counts. Adding deterministic NPC interaction sources or derived Relationship views does not require another schema change.

## Trade

The minimal Trade Module implements non-realtime fixed-price consignment only. A seller submits a server-shaped listing intent with quantity and total price; the authoritative action immediately removes the listed stack from the seller inventory into a persisted escrow listing. This prevents the same item from being consumed, crafted, or listed again while it is for sale.

A purchase is one Action Resolver draft: buyer money is reduced, seller money is increased, the escrowed item is added to the buyer, and the listing is removed. This is a player-to-player money transfer, not a money source or sink. A seller may cancel an active listing and atomically reclaim escrow. Invalid, unaffordable, self-purchase, non-owner cancel, seller-unavailable, balance-overflow, or inventory-overflow cases fail before asset mutation.

Trade listings are globally bounded at 50 in this development slice, and all 50 are visible through the public trade view so no escrow becomes unreachable through truncation. Public listing data exposes item name/quantity, total price, public seller name, listing ID, and a server-generated buy/cancel intent; seller session IDs, character IDs, and internal item IDs are not exposed in the listing projection.

There is no listing expiration worker, polling loop, scheduler, auction engine, contract engine, or external marketplace service. Auctions, designated contracts, regional market segmentation, and taxes/fees remain later Trade/Auction work. If a character is authoritatively declared dead in the future, the Estate settlement primitive removes that character's active listings and transfers their escrowed stacks into the pending Estate before the active slot is released.

## Death archive and Estate settlement

The current Estate Module establishes a server-side settlement primitive only; it does **not** expose a player-callable death action and it does not invent a death threshold. Combat, disease, poison, starvation, dangerous choices, or other future authoritative systems must first adjudicate that death actually occurred, then call the deterministic settlement primitive with the active `sessionId`, exact `characterId`, and bounded cause code.

Settlement is one authoritative draft operation. The active character is removed from the session slot and written to `archivedCharacters` with death time, cause code, final location, survival state, and behavior aggregates. The archive deliberately contains no money or inventory. Current inventory, money, and every still-listed Trade escrow stack owned by that exact character are consolidated into one `pending` Estate record; the corresponding listings are removed. This makes spendable assets exist in exactly one authoritative place after death.

The archive remains tied server-side to its original session for historical/account evidence, but the active session slot becomes empty. The same account may therefore start a new character with the normal birth flow and a new monotonic character ID. The new character receives no automatic money, items, family control, knowledge, or NPC familiarity from the prior character. Estate distribution is intentionally unresolved: law, wills, debt, family/NPC, property, auctions, historical-item promotion, and other inheritance rules must decide future disposition in later modules rather than being guessed by this primitive.

Historical archive locations may outlive current Content Pack entries. Pending Estate items cannot: until an Estate is resolved, those stacks remain current authoritative assets and are protected by the same fail-closed Content Pack compatibility boundary as active inventory and Trade escrow.

## Crafting

The minimal Crafting Module accepts a recipe intent only when that recipe exists at the character's authoritative current location. It verifies all required stackable inputs before consuming anything, then atomically removes inputs and adds the validated output on the Action Resolver draft. Missing materials or an unavailable recipe produce no committed mutation. Successful crafting emits bounded `crafting.completed` evidence plus behavior evidence, and generic request idempotency prevents retry-driven duplicate production or duplicate progression.

Crafting recipes, ingredient/output quantities, and behavior IDs live in the Content Pack. Narrative exposes crafting as deterministic functional UI only when the module action is registered; disabling the Crafting Module therefore removes its UI without breaking Core or other gameplay.

## Purpose actions

Purpose actions express intent rather than a destination claim. The current minimal NPC-search flow lets the server inspect the authoritative NPC location and route graph, resolve at most one valid travel step, and return only the player's resulting location plus public target identity. The browser never receives the NPC's hidden authoritative location or a full path, and the action remains subject to normal server validation and feature/module availability.

## World schema

Persisted world state carries an explicit schema version. The runtime migrates supported older schemas deterministically before authoritative adjudication and rejects unknown newer schemas rather than silently resetting or guessing. Schema v2 backfills stable character sequencing and survival fractional progress from legacy v1 saves; schema v3 adds authoritative behavior-count aggregates used by derived progression, career, and relationship rules; schema v4 adds bounded fixed-price trade escrow/listing state and a monotonic listing sequence; schema v5 adds empty-by-default `archivedCharacters` and `estates` collections. The v4→v5 migration is additive and does not move any existing active character assets. Survival condition and NPC familiarity are derived from existing authoritative state plus Content Pack policy, so neither requires a schema change.

## Cost model

No background worker, polling loop, database, AI provider, queue, analytics service, marketplace service, or production deployment is required for the current slice. World progression uses logical time plus timestamp/lazy elapsed resolution on the next authoritative request. Trade is entirely request-driven and bounded in persisted count and public payload. Survival condition classification, rest, NPC familiarity recording, and Relationship projection are synchronous deterministic calculations on player requests. Estate settlement likewise runs only when a future authoritative death event explicitly invokes it; there is no death scanner or estate scheduler.

## Deferred production adapters

Production persistence, real authentication/session, production serverless adapter, Estate distribution rules, permanent death triggers, richer survival/environment rules, richer NPC relationship consequences, migrations beyond the currently implemented schema path, and platform-level Event Bus/Registry/Feature Flag contracts remain intentionally deferred until their concrete integration is required.
