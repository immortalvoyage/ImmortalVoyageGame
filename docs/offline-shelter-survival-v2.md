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

## Lazy-resolution semantics

The shared World Clock always resolves the **full** elapsed real time. Shelter protection does not slow, pause, or rewrite world time.

Only the Survival exposure for a character currently located in a declared shelter is bounded for one uninterrupted request gap:

```text
world elapsed = now - lastResolvedAt
survival elapsed = min(world elapsed, shelter.absenceSurvivalCapSeconds)
```

A 72-hour request gap in the current first-settlement lodging therefore still advances the world by 72 hours, while Survival needs receive at most six hours of elapsed exposure for that gap.

The cap is intentionally per uninterrupted gap rather than a permanent rate multiplier. Short active gaps below the cap continue accumulating normally, including existing fractional `needProgressSeconds`. This avoids reintroducing the old high-frequency fractional-time loss bug and avoids interval-conversion errors when a character leaves a shelter.

Locations without a shelter declaration keep the existing full elapsed Survival pressure. Leaving the lodging immediately removes the protection for future elapsed gaps.

## Authority and privacy

The Browser cannot declare shelter status, choose the cap, or submit an offline-resolution result. The authoritative character location and validated Content Pack determine whether the cap applies when the next server request lazily resolves elapsed time.

`absenceSurvivalCapSeconds` and the raw `shelter` contract are not included in the public scene projection. Public text may describe that a location is suitable for lodging, but the tuning value remains server-side.

`GameRuntime` now gives elapsed resolvers the same server-owned runtime context already available to action handlers. Core remains domain-agnostic; Survival alone interprets the Content Pack shelter contract.

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

The implementation is request-driven and uses existing Content Pack data plus existing character Survival progress. There is no new world schema, database, scheduler, queue, worker, polling loop, heartbeat, AI call, or paid service.
