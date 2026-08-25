# V2 Offline Shelter / Absence Survival Slice

## Goal

The shared world continues to advance while a player is not sending requests, but a character who leaves their body in a validated safe shelter must not receive the same uninterrupted Survival exposure as a character abandoned in the street or wilderness.

This slice implements only the smallest deterministic shelter protection needed for the mortal-life Critical Path. It does not add a background Offline State worker, heartbeat, scheduler, presence service, offline job simulation, health/death resolver, or AI.

## Content contract

A location may optionally declare:

```js
shelter: {
  absenceSurvivalCapSeconds: 21600,
}
```

The cap is server-owned Content Pack tuning. The validator requires:

- the shelter location must also be a legal `rest` location;
- `absenceSurvivalCapSeconds` must be a positive safe integer;
- the value is bounded to at most 30 days.

The first-settlement public lodging uses a six-hour cap. Its description states that the lodging provides minimum overnight care; the candidate name remains low-lore and is not promoted to novel/world Canon.

## Shared World Clock correction

PR #89 originally applied the shelter cap independently to each **global** lazy-resolution gap. That is insufficient in a shared world: another player's frequent requests can advance the global World Clock in many small steps and would repeatedly restart another offline character's six-hour cap.

The corrected contract therefore accounts for absence **per active character**, not per global request gap. World schema v8 adds two server-only active-character timestamps:

- `lastActiveLogicalTimeSeconds`: logical time of that character's most recent successful authoritative request;
- `lastSurvivalResolvedLogicalTimeSeconds`: logical time through which Survival has already accounted for that character.

These are accounting metadata, not public gameplay facts. They are removed by `publicCharacter`, are not inherited by a new life, and are not copied into the historical death archive. The v7→v8 migration initializes both fields for active characters to the current world logical time so an upgrade does not invent retroactive absence exposure.

## Lazy-resolution semantics

The shared World Clock always resolves the **full** elapsed real time. Shelter protection does not slow, pause, or rewrite world time.

On any request that advances the shared clock, Survival evaluates every active character from their own accounting timestamps. Let:

```text
A = lastActiveLogicalTimeSeconds
R = lastSurvivalResolvedLogicalTimeSeconds
L = current world logicalTimeSeconds
start = max(A, R)
```

For an ordinary location, the newly chargeable Survival exposure is simply:

```text
delta = max(0, L - start)
```

For a shelter with cap `C`, only the not-yet-charged part of the current character absence episode is applied:

```text
previousAbsence = max(0, start - A)
currentAbsence  = max(0, L - A)
delta = max(0, min(currentAbsence, C) - min(previousAbsence, C))
```

After Survival resolves the character, `R` becomes `L`. After that character's own successful request commits, `A` becomes `L` and a future absence episode starts from that activity time.

Consequences:

- a sheltered character absent for 72 hours receives at most the configured six hours of Survival exposure even if another player advances the world every hour;
- another player's activity never resets or extends that character's shelter allowance;
- an unsheltered character still receives full elapsed Survival pressure;
- when the sheltered character returns successfully, later elapsed time starts a new episode normally;
- existing fractional `needProgressSeconds` remains authoritative and continues accumulating exactly.

A successful idempotent replay returns before World Clock resolution and does not count as new activity. A failed action is not persisted and therefore does not move the activity clock. This preserves existing request-idempotency and failure-recovery boundaries.

## Authority and privacy

The Browser cannot declare shelter status, choose the cap, set activity timestamps, or submit an offline-resolution result. Authoritative character location, logical world time, server request success, and validated Content Pack rules determine the accounting.

`absenceSurvivalCapSeconds`, raw `shelter`, `lastActiveLogicalTimeSeconds`, and `lastSurvivalResolvedLogicalTimeSeconds` are not included in the public character/scene projection.

`GameRuntime` only records generic successful actor activity and provides the same server-owned runtime context to elapsed resolvers. Core does not interpret shelter quality or Survival rules; Survival owns exposure calculation.

## Boundaries

This is not the complete Offline State system. Deferred behavior includes:

- food/water inventory or lodging fees consumed during absence;
- employer attendance, shifts, wages, dismissal, or offline occupation duties;
- unsafe-area hazards, weather, disease, injury, combat, or death while absent;
- owned housing and different shelter qualities;
- NPC/social consequences of prolonged disappearance;
- caravans, ships, travel-in-progress, or interruption during absence.

Permanent death remains separate and still requires an explicit health/injury/death resolver. Shelter accounting never revives, kills, teleports, pays, feeds, or moves a character by itself.

## Free-First impact

The implementation remains request-driven and uses two bounded integer timestamps per active character plus existing Content Pack and Survival state. There is no database, scheduler, queue, worker, polling loop, heartbeat, presence service, AI call, or paid service. Idle compute remains zero.
