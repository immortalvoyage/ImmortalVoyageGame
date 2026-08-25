# V2 Offline Shelter / Absence Survival Slice

## Goal

The shared world continues to advance while a player is not sending requests, but a character who deliberately leaves their body in a validated safe shelter must not receive the same uninterrupted Survival exposure as a character abandoned in the street or wilderness.

This slice implements only the smallest deterministic shelter protection needed for the mortal-life Critical Path. It does not add a background Offline State worker, heartbeat, scheduler, presence service, offline job simulation, health/death resolver, or AI.

## Content contract

A location may optionally declare:

```js
shelter: {
  absenceSurvivalCapSeconds: 21600,
}
```

The cap is server-owned Content Pack tuning. The current validator requires:

- the shelter location must also be a legal `rest` location;
- `absenceSurvivalCapSeconds` must be a positive safe integer;
- the value is bounded to at most 30 days.

The first-settlement public lodging uses a six-hour cap. Its description explicitly states that the lodging provides minimum overnight care; the candidate name remains low-lore and is not promoted to novel/world Canon.

## Per-character lazy-resolution semantics

The shared World Clock always resolves the **full** elapsed real time. Shelter protection does not slow, pause, or rewrite world time.

World schema v8 gives each active character a server-only `lastActiveLogicalTimeSeconds`. The field records the shared logical time of that character's last successfully committed request. It is not a Browser presence claim and is not sent in public character projections.

When a character next makes a request, Survival derives that character's own absence from shared logical time rather than from the most recent global request gap:

```text
personal absence = world.logicalTimeSeconds - character.lastActiveLogicalTimeSeconds
survival exposure = min(personal absence, shelter.absenceSurvivalCapSeconds) // at a shelter
survival exposure = personal absence                                     // elsewhere
```

Only the requesting character is resolved by the Survival elapsed hook. Requests from another player may advance the shared World Clock, but they neither mutate this character's needs nor advance this character's activity marker. Therefore another player's hourly activity cannot split a sheltered character's 72-hour absence into seventy-two one-hour gaps and accidentally bypass the six-hour shelter cap.

Elapsed hooks are invoked on every authenticated non-replayed request, even when that request does not itself advance the global clock. This matters when another player already advanced world time: the returning character may have a non-zero personal absence while the current global request gap is zero.

After a successful request commits, Core updates that active owner's generic activity marker to the committed shared logical time. If Survival is feature-flagged off, successful requests still advance the generic marker, so re-enabling Survival later does not retroactively charge downtime that occurred while the module was disabled.

A newly born character starts with `lastActiveLogicalTimeSeconds = world.logicalTimeSeconds`. Schema v7→v8 migration backfills existing active characters at the already-resolved current logical time, avoiding retroactive double exposure from time that older saves had already resolved under the previous model. Archived characters do not keep this active-session clock.

Short active gaps continue accumulating normally, including existing fractional `needProgressSeconds`. Locations without a shelter declaration keep full personal-absence Survival pressure. Leaving the lodging immediately removes shelter protection from later personal absence.

## Authority and privacy

The Browser cannot declare shelter status, choose the cap, submit an offline-resolution result, or set `lastActiveLogicalTimeSeconds`. The authoritative active-character location, validated Content Pack, shared World Clock, and server-maintained activity marker determine the next lazy Survival settlement.

`absenceSurvivalCapSeconds`, the raw `shelter` contract, and `lastActiveLogicalTimeSeconds` are not included in public scene projections. Public text may describe that a location is suitable for lodging, but tuning and activity bookkeeping remain server-side.

Core owns only the generic request/activity timestamp boundary. Survival alone interprets that timestamp together with the Content Pack shelter contract. No shelter rule is hard-coded into World Clock or Browser code.

## Boundaries

This is not the complete Offline State system. Deferred behavior includes:

- food/water inventory or lodging fees consumed during absence;
- employer attendance, shifts, wages, dismissal, or offline occupation duties;
- unsafe-area hazards, weather, disease, injury, combat, or death while absent;
- owned housing and different shelter qualities;
- NPC/social consequences of prolonged disappearance;
- caravans, ships, travel-in-progress, or interruption during absence.

Permanent death remains separate and still requires an explicit health/injury/death resolver. This shelter cap never revives, kills, teleports, pays, feeds, or moves a character by itself.

## Free-First impact

The implementation is request-driven and stores one bounded integer on each active character. There is no database, scheduler, queue, worker, polling loop, heartbeat, presence service, AI call, or paid service. Idle compute remains zero.
