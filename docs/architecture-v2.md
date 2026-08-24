# V2 Architecture Notes

This rewrite keeps the authoritative game runtime on the server side and treats browser output as untrusted presentation/input only.

## Current boundaries

- Core: world clock, world state, action resolution, schema migration, module manifest validation, permission boundary, bounded idempotency/event/trade state, archived-character/estate structural invariants.
- Modules: character, inventory, location, NPC, purpose action, survival, economy, trade, crafting, progression, career, relationship, knowledge, estate, situation, narrative.
- Content: disposable versioned starter content used only to prove the critical path and small post-loop modules. Game wiring validates one server-owned Content Pack before gameplay consumes it.
- Browser: submits intents through `/api/action`; it does not import Core modules or own world truth.
- Local dev server: zero-dependency Node server with local file-backed world persistence for development only.

## Content Pack boundary

Gameplay content stays server-side and versioned. The current starter pack owns the starting location, structured location routes with deterministic travel duration/cost tuning, NPC placement, items, jobs, market offers, gatherables, crafting recipes, progression tags, career rules, optional NPC familiarity rules/responses/topics, explicit `knownAtStart` NPC discovery flags, bounded Knowledge facts and optional NPC-reveal references, optional topic knowledge grants, survival warning/critical thresholds, basic rest relief, and their deterministic tuning values. A deterministic validator rejects malformed route objects, broken route/NPC/item/recipe/behavior/knowledge references, duplicate route destinations, invalid or unbounded route durations, unknown/invalid route need costs, invalid progression kinds or thresholds, invalid or reversed survival thresholds, invalid rest relief, malformed or colliding NPC relationship behavior IDs, unordered/duplicate familiarity levels, empty configured familiarity response text, malformed or duplicate familiarity topic IDs, missing topic labels/responses, malformed/duplicate/unknown topic knowledge grants, malformed/duplicate/unknown Knowledge NPC reveal references, non-boolean `knownAtStart`, duplicate local rules, free recipes with no inputs, empty behavior requirements, unknown need keys, invalid quantities/prices/rewards, and a missing starting location before the pack is accepted by game wiring.

`src/game.js` is the composition boundary: it validates the selected Content Pack and injects it into the authoritative runtime context. `GameRuntime` remains content-agnostic and only forwards server-owned runtime context to registered action handlers. Gameplay modules do not import the development starter pack directly; modules that need current content consume the injected pack. This makes a future validated Content Pack replaceable without editing gameplay modules or creating a second registry.

The default development wiring still selects `devStarterPack`, while tests or future server wiring may supply another validated pack. There is no remote content fetch, hot reload service, database, scheduler, polling loop, AI call, or other runtime dependency associated with this injection boundary.

### Persisted world compatibility

A Content Pack that is internally valid can still be incompatible with an existing authoritative save. After supported world-schema migration and before idempotent replay or elapsed/action resolution, game wiring runs a deterministic world/content compatibility assertion. Current character locations and inventory stacks must reference active content. Active-character `knowledgeIds` must likewise reference the active Knowledge catalog. Trade escrow stacks and unresolved Estate inventory are also current authoritative assets, so their item templates must still exist in the active Content Pack.

Historical event evidence, archived-character locations, and archived-character Knowledge references are intentionally not revalidated against current catalogs: old events, death locations, or facts learned by a deceased character may legitimately reference retired content and remain historical records. By contrast, current active knowledge and assets that may still affect present gameplay may not silently become orphans. A mismatch fails closed and does not rewrite the save. This guard does not guess replacement IDs, discard inventory, erase learned facts, teleport characters, or perform automatic content migration; intentional content removal therefore requires an explicit data/content migration decision.

`GameRuntime` owns only a generic `validateLoadedWorld` callback. The Content Pack-specific compatibility logic remains under `src/content/` and is wired by `src/game.js`, so Core does not become a second content registry.

## Authoritative mutation and world-state invariants

After supported schema migration, Core validates the structural invariants that every current save must satisfy before gameplay or cached replay can proceed. This includes world identity/time, active character ownership and identity, bounded 0–100 survival needs, nonnegative survival progress and behavior counters, bounded unique non-empty character Knowledge IDs, stack inventory quantities, nonnegative integer money, bounded trade listings, paired archived-character/Estate records, nonduplicated Estate assets, and internal consistency/size limits for request-result and game-event ledgers.

Successful action drafts are validated a second time immediately before persistence, after bounded event/request evidence is recorded. Both structural validation and the injected domain/content validator must pass. A handler therefore cannot return `ok: true` and silently persist malformed or orphaned authoritative state. Validation failure leaves the store unchanged.

These checks are validation only: malformed state is rejected instead of silently repaired. Existing writer functions remain responsible for trimming request/event ledgers to their 256-entry caps. Content-specific references remain outside Core and are checked separately by the world/content compatibility guard.

## Survival condition and reversible pressure

Survival needs remain authoritative numeric state and continue to advance by logical elapsed time when the Survival Module is enabled. The current starter Content Pack defines a warning threshold and a higher critical threshold. A public condition projection is derived from current hunger, thirst, and fatigue; the thresholds themselves are server/content tuning and are not copied into persistent character state.

Warning is informational only. At critical condition, `economy.work` is rejected before reward, behavior, or need-cost mutation. Narrative also hides work choices and tells the player to address the affected needs, but this presentation behavior is not the security boundary: a forged work request is still rejected server-side.

The guard deliberately preserves recovery paths. Hunger can be reduced by gathered or purchased food, thirst by gathered or purchased water, and fatigue by the minimal deterministic `survival.rest` action. Travel, gathering, consuming supplies, purchasing supplies, and rest are not blocked by the critical work guard. The development map keeps basic water and food reachable from the starter square so a player without money still has a recovery route.

Basic rest is request-driven and only decreases fatigue by a validated Content-Pack amount; it creates no item, money, background timer, lodging state, or world-time jump. Richer sleep, accommodation, temperature, encumbrance, offline activity, illness, and environmental exposure remain later modules/rules rather than being approximated here.

The Survival Module can still be disabled. Economy checks runtime action availability before applying the survival work guard, so disabling Survival does not leave stale need values as a hidden dependency that can permanently block work. Narrative likewise omits the public condition and rest utility when Survival actions are unavailable.

This slice is intentionally **not a death trigger**. Reaching warning or critical need levels does not call Estate settlement and does not permanently kill a character. Permanent death requires a separately approved authoritative hazard/death rule with explicit warning and relief semantics.

## Location / Movement Resolver

Content Pack v14 upgrades each location route from a bare destination ID to a bounded server-owned contract: `{ destinationId, travelSeconds, needCosts }`. `travelSeconds` must be a positive safe integer and is capped at 30 days per route; `needCosts` may only contain known Survival needs with nonnegative bounded values. The public Location projection exposes only the destination's public identity/description plus validated `travelSeconds`. Raw route need-cost tuning stays server-side.

`location.travel` still accepts only a destination intent. The Location Module verifies that the destination is an adjacent authoritative route, moves the character on the Action Resolver draft, applies that route's deterministic need costs when Survival is active, saturates needs at 100, and emits a bounded `character.travelled` event containing the public destination and route duration evidence. If the Survival Module is disabled, movement remains available and route need costs are not left behind as a hidden disabled-module dependency.

A player's trip does **not** fast-forward the shared World Clock. The shared timeline continues to advance from real elapsed time through the existing logical-time/lazy-resolution path. Route duration is deterministic journey metadata and local action cost, not permission for one player's request to advance every other player's world by five minutes, fifteen minutes, or several days. This first movement slice resolves the route immediately; later journey interruption/deadline rules may consume the duration without introducing a permanent movement worker.

Purpose movement reuses the exact same `applyTravelStep` contract rather than maintaining a second movement mutation path. Once routes carry time, Purpose routing chooses the reachable path with the least total validated travel duration instead of simply minimizing route-hop count; each `purpose.find-npc` request still resolves at most one route step and preserves the known-target/privacy boundary. Situation and the Narrative module-off fallback show approximate public route duration in their movement labels, while Browser intents still contain only the destination ID.

This slice deliberately does not yet model carried weight, transport mode, terrain/weather multipliers, road closure, tolls, vehicles/ships, departure schedules, encounters during transit, retreat, getting lost, camping, or long-journey checkpoints. Those belong in later Movement/Journey rules and must remain deterministic, request/lazy-driven, and compatible with Situation rather than introducing per-player polling or AI-dependent navigation.

## Situation / Opportunity Resolver

The Situation Module is the first orchestration layer for the “one mortal day” vertical slice. It does not create a second world-state machine: it reads current authoritative character state plus the validated Content Pack and deterministically projects at most four server-shaped world opportunities. The current sources are visible NPC interaction, already-known Purpose targets, local work, local gathering, and legal route movement. It stores no new persistent state and adds no schema field.

Situation opportunities are distinct from Functional Controls. Trade browsing/listing, crafting, inventory use, rest, unlocked NPC information topics, and similar deterministic utilities remain outside the four main narrative opportunities. This keeps the primary reading flow focused on “what meaningful thing can I do next?” instead of turning the scene into a list of every system button.

Normal situations reserve category diversity rather than concatenating every candidate and taking the first four. When available, the bounded set keeps room for an ongoing known Purpose, one social interaction, one livelihood action (work first, otherwise gathering), and one route exit before filling spare slots. A crowded settlement therefore cannot let many visible NPCs crowd work and movement out of the playable loop.

Critical survival pressure uses a different deterministic ordering: immediate gathering and travel/recovery routes come before optional social or Purpose content, and work is omitted from the projected opportunities. This is only presentation/orchestration; the authoritative Survival guard still rejects forged work requests independently, so Situation is not a security boundary.

Narrative calls the same pure Situation opportunity builder when `situation.observe` is registered, so direct Situation observation and Narrative choices share one contract. If the Situation Module is feature-disabled, Narrative retains the prior bounded deterministic option builder as a safe fallback rather than becoming unusable. The Situation projection only emits public labels and action intents. Knowledge-derived Purpose opportunities still depend on authoritative learned state and never expose target `locationId`, raw `knowledgeIds`, or Knowledge effect metadata.

This first slice intentionally does not simulate schedules, employment shifts, event calendars, deadlines, weather opportunities, world-event consequences, NPC proactive invitations, or weighted daily variety. Those later opportunity sources should plug into the same bounded resolver contract and remain request-driven/lazy where possible; they must not require per-character polling, a permanent background simulation loop, or an AI call just to decide which legal actions exist.

## Behavior, progression, career, and relationships

Characters do not choose a fixed profession at birth. Successful authoritative work, gather, craft, and configured NPC-interaction actions may record compact Content-Pack-defined behavior counts. Rejected actions do not record behavior, request idempotency prevents retries from incrementing a behavior twice, and the shared behavior writer saturates at `Number.MAX_SAFE_INTEGER` instead of overflowing persisted counters.

The Progression Module derives public skill/social tags from those authoritative behavior counts plus Content Pack requirements. Derived tags are not persisted as duplicate state and expose only public names; raw behavior IDs, thresholds, and counters remain server-side. Disabling the Progression Module hides these derived tags without disabling work, gathering, crafting, or Core gameplay.

Career identities use the same authoritative behavior source but remain a separate module and a higher-order derived identity. Career identity is likewise not stored as duplicate permanent state: Career recomputes the currently satisfied public identities when observed. Disabling the Career Module hides derived identities without disabling the underlying actions.

The Relationship Module follows the same pattern for NPC familiarity. A configured NPC interaction records a unique server-only behavior ID only after authoritative ownership/location checks pass. Familiarity levels live in the Content Pack with strictly increasing interaction-count thresholds. Relationship observation returns only NPC public identity plus the highest satisfied familiarity name; it does not expose the raw behavior ID, count, or thresholds, and NPCs with no satisfied familiarity level are not added to the relationship list. This prevents the module from revealing otherwise unknown NPCs merely because they exist in server content.

Familiarity may affect deterministic NPC dialogue without adding AI or a second memory store. A familiarity level can optionally define `responseText`. `npc.interact` resolves the highest familiarity **before** recording the current interaction, so a first meeting still uses the base greeting; a later interaction uses the already-earned familiarity response. If the current level has no response text, the NPC safely falls back to its base greeting. The NPC Module only applies familiarity-aware responses while `relationship.observe` is actually registered, so disabling the Relationship Module restores the original fixed greeting while successful NPC interactions may continue recording their authoritative behavior evidence.

Familiarity levels may also unlock deterministic structured information topics. Topics are accumulated from satisfied familiarity levels, but only their public `id` and `label` are projected into Narrative utilities while the NPC is currently visible and `npc.ask` is registered. Locked topic response text remains server-side and is not sent to the Browser. `npc.ask` rechecks active-character ownership, authoritative NPC location, Relationship availability, and current topic unlock before returning the Content-Pack-defined response. Guessing a locked or unknown topic ID therefore fails closed. Asking a topic does not record interaction behavior or increase familiarity, so repeatedly reading the same information cannot farm relationship progress.

Relationship is derived state, not a second persisted relationship table. Turning the Relationship Module off hides the projection and familiarity-gated topics but does not disable base NPC interaction or erase its authoritative behavior evidence. Because a newly born character starts with empty `behaviorCounts`, a later life does not automatically inherit the prior character's familiarity or unlocked topics. A deceased character's archived behavior aggregates remain historical evidence tied to that archived character.

NPC relationship behavior IDs must not collide with other authoritative behavior sources. This avoids one NPC interaction accidentally advancing another NPC or a work/gather/craft action advancing familiarity. Once declared, an NPC interaction behavior may be referenced by other Content-Pack-derived rules such as a future social tag or career condition.

World schema v3 adds `behaviorCounts` and migrates v2 saves by backfilling an empty map while preserving any valid existing counts. Adding deterministic NPC interaction sources, familiarity-aware response text/topics, or derived Relationship views does not require another relationship-specific schema table.

## Knowledge / Discovery

Topic eligibility and durable character knowledge are separate concepts. A familiarity level may make a topic askable, but the character does not learn the topic's configured facts until an authoritative `npc.ask` succeeds. The Browser cannot grant knowledge by displaying a topic or by submitting a guessed fact ID.

World schema v6 adds `character.knowledgeIds`, a server-only array of unique non-empty Knowledge IDs with a hard cap of 128. Birth initializes an empty list. The v5→v6 migration backfills an empty list for active and archived characters while preserving already-valid values. The raw IDs are not part of `publicCharacter` and are never required by the Browser.

The Knowledge Module exposes only `knowledge.observe`. Its public projection contains fact names such as `{ name }`; internal IDs and effect metadata such as `revealsNpcIds` remain server-side. A successful topic ask may call the bounded grant helper using Content-Pack-defined `grantsKnowledgeIds`. Newly learned facts emit bounded `knowledge.learned` evidence with source type, source NPC ID, and source topic ID. Repeated asks are no-ops for already-known facts, and generic request idempotency prevents replay from duplicating grants or evidence. If a grant would exceed the 128-fact cap, the grant fails atomically rather than partially mutating the character.

Knowledge may have a deterministic server-side effect only when the active Content Pack explicitly declares one. The current slice supports optional `revealsNpcIds`: after the character has actually learned such a fact, the shared Purpose known-target resolver may accept that NPC as a known target while the Knowledge Module is active. The public Purpose intent still contains only the target NPC ID and never the authoritative target location. A forged unknown target still fails before travel mutation.

Narrative projections deliberately use the authoritative character only for server-side derivation of familiarity topics and Knowledge-derived Purpose targets. The public character object remains stripped of `behaviorCounts` and `knowledgeIds`. This prevents a privacy fix from accidentally disabling legitimate server-side option derivation while still keeping raw state out of the response.

Knowledge Module-off behavior is explicit: `npc.ask` remains readable when Relationship permits the topic, but no knowledge is granted, no Knowledge projection is returned, and persisted knowledge has no Knowledge-derived Purpose effect until the module is enabled again. Disabling the module does not erase stored knowledge.

Death does not convert knowledge into an Estate asset. Estate archive preserves the deceased character's `knowledgeIds` as historical character state, while the next birth always starts with an empty list. The same account therefore does not automatically inherit the prior life's learned NPCs, routes, recipes, rumors, or other facts. Active-character Knowledge references must remain compatible with the active Content Pack; archived historical Knowledge references may outlive the current catalog.

This is intentionally a minimal durable-fact slice, not the complete future Information/Claim system. Source chains, `observedAt`, freshness/staleness, confidence/reliability, disputed claims, propagation hops, market-intelligence timing, maps/routes, rumor trade, and broader discovery effects remain deferred. Those later systems must preserve the same rule that World Fact belongs to the World Engine while characters hold bounded claims/knowledge rather than omniscient truth.

## Trade

The minimal Trade Module implements non-realtime fixed-price consignment only. A seller submits a server-shaped listing intent with quantity and total price; the authoritative action immediately removes the listed stack from the seller inventory into a persisted escrow listing. This prevents the same item from being consumed, crafted, or listed again while it is for sale.

A purchase is one Action Resolver draft: buyer money is reduced, seller money is increased, the escrowed item is added to the buyer, and the listing is removed. This is a player-to-player money transfer, not a money source or sink. A seller may cancel an active listing and atomically reclaim escrow. Invalid, unaffordable, self-purchase, non-owner cancel, seller-unavailable, balance-overflow, or inventory-overflow cases fail before asset mutation.

Trade listings are globally bounded at 50 in this development slice, and all 50 are visible through the public trade view so no escrow becomes unreachable through truncation. Public listing data exposes item name/quantity, total price, public seller name, listing ID, and a server-generated buy/cancel intent; seller session IDs, character IDs, and internal item IDs are not exposed in the listing projection.

There is no listing expiration worker, polling loop, scheduler, auction engine, contract engine, or external marketplace service. Auctions, designated contracts, regional market segmentation, and taxes/fees remain later Trade/Auction work. If a character is authoritatively declared dead in the future, the Estate settlement primitive removes that character's active listings and transfers their escrowed stacks into the pending Estate before the active slot is released.

## Death archive and Estate settlement

The current Estate Module establishes a server-side settlement primitive only; it does **not** expose a player-callable death action and it does not invent a death threshold. Combat, disease, poison, starvation, dangerous choices, or other future authoritative systems must first adjudicate that death actually occurred, then call the deterministic settlement primitive with the active `sessionId`, exact `characterId`, and bounded cause code.

Settlement is one authoritative draft operation. The active character is removed from the session slot and written to `archivedCharacters` with death time, cause code, final location, survival state, behavior aggregates, and learned Knowledge IDs. The archive deliberately contains no money or inventory. Current inventory, money, and every still-listed Trade escrow stack owned by that exact character are consolidated into one `pending` Estate record; the corresponding listings are removed. This makes spendable assets exist in exactly one authoritative place after death while learned information remains historical character state rather than a distributable asset.

The archive remains tied server-side to its original session for historical/account evidence, but the active session slot becomes empty. The same account may therefore start a new character with the normal birth flow and a new monotonic character ID. The new character receives no automatic money, items, family control, knowledge, or NPC familiarity from the prior character. Estate distribution is intentionally unresolved: law, wills, debt, family/NPC, property, auctions, historical-item promotion, and other inheritance rules must decide future disposition in later modules rather than being guessed by this primitive.

Historical archive locations and archived Knowledge references may outlive current Content Pack entries. Pending Estate items cannot: until an Estate is resolved, those stacks remain current authoritative assets and are protected by the same fail-closed Content Pack compatibility boundary as active inventory and Trade escrow.

## Crafting

The minimal Crafting Module accepts a recipe intent only when that recipe exists at the character's authoritative current location. It verifies all required stackable inputs before consuming anything, then atomically removes inputs and adds the validated output on the Action Resolver draft. Missing materials or an unavailable recipe produce no committed mutation. Successful crafting emits bounded `crafting.completed` evidence plus behavior evidence, and generic request idempotency prevents retry-driven duplicate production or duplicate progression.

Crafting recipes, ingredient/output quantities, and behavior IDs live in the Content Pack. Narrative exposes crafting as deterministic functional UI only when the module action is registered; disabling the Crafting Module therefore removes its UI without breaking Core or other gameplay.

## Purpose actions and known-target privacy

Purpose actions express intent rather than a destination claim. The current minimal NPC-search flow lets the server inspect the authoritative NPC location and structured route graph, select the least-total-travel-time reachable path, resolve at most one valid route step per request, and return only the player's resulting location plus public target identity and the duration of the resolved step. The browser never receives the NPC's hidden authoritative location or a full path, and the action remains subject to normal server validation and feature/module availability.

An NPC with a `searchLabel` is **not automatically a known target** merely because it exists in the server Content Pack. Narrative and `purpose.find-npc` share one deterministic known-target resolver. A target is considered known when the character is co-located with it, the Content Pack explicitly marks it `knownAtStart: true`, that same character has previously completed a successful configured interaction with it, or—while the Knowledge Module is active—the character has actually learned a fact whose explicit `revealsNpcIds` references that NPC. Narrative therefore does not enumerate every searchable NPC, and a forged `purpose.find-npc` payload that guesses an unknown NPC ID fails with `PURPOSE_TARGET_UNKNOWN` before any travel mutation.

The public target projection contains only target ID, public name, and search label; it never exposes authoritative `locationId`. A player may still discover an initially unknown NPC by ordinary exploration: once physically co-located, that NPC is visible through Location/NPC projection; after a successful interaction, the interaction behavior is durable evidence that the character has met that NPC and may later search for them. This remains functional even if the Relationship presentation module is disabled, because successful interaction evidence is an independent authoritative fact.

Familiarity topic eligibility remains intentionally **not** equivalent to persistent knowledge. A topic becoming askable does not prove that the character actually asked it. Durable dialogue discovery only occurs after successful authoritative `npc.ask` and only for Content-Pack-declared knowledge grants. This preserves the PR #81 anti-enumeration boundary while allowing explicit learned information to affect later Purpose choices.

## World schema

Persisted world state carries an explicit schema version. The runtime migrates supported older schemas deterministically before authoritative adjudication and rejects unknown newer schemas rather than silently resetting or guessing. Schema v2 backfills stable character sequencing and survival fractional progress from legacy v1 saves; schema v3 adds authoritative behavior-count aggregates used by derived progression, career, and relationship rules; schema v4 adds bounded fixed-price trade escrow/listing state and a monotonic listing sequence; schema v5 adds empty-by-default `archivedCharacters` and `estates` collections; schema v6 adds bounded server-only `knowledgeIds` to active and archived characters. The v5→v6 migration is additive and backfills empty Knowledge arrays without inventing cross-life inheritance. Survival condition, NPC familiarity, response selection, topic unlocks, Situation projection, and Movement route selection remain derived from existing authoritative state plus Content Pack policy.

## Cost model

No background worker, polling loop, database, AI provider, queue, analytics service, marketplace service, or production deployment is required for the current slice. World progression uses logical time plus timestamp/lazy elapsed resolution on the next authoritative request. Trade is entirely request-driven and bounded in persisted count and public payload. Survival condition classification, route validation/movement cost resolution, shortest-duration Purpose route selection, rest, NPC familiarity recording, Relationship projection, familiarity-aware deterministic NPC response selection, topic unlock/answer resolution, Knowledge grant/projection/known-target checks, bounded Situation/Opportunity selection, and Purpose search are synchronous calculations on player requests. Estate settlement likewise runs only when a future authoritative death event explicitly invokes it; there is no death scanner, movement worker, knowledge propagation worker, situation scheduler, or estate scheduler.

## Deferred production adapters

Production persistence, real authentication/session, production serverless adapter, Estate distribution rules, permanent death triggers, richer survival/environment rules, richer Movement/Journey rules such as encumbrance/transport/terrain/interruptions, dynamic Information/Claim provenance/freshness/reliability/propagation, richer Situation sources such as schedules/employment/world-event deadlines, richer NPC relationship consequences beyond deterministic response/topic information, migrations beyond the currently implemented schema path, and platform-level Event Bus/Registry/Feature Flag contracts remain intentionally deferred until their concrete integration is required.