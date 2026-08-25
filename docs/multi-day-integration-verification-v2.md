# V2 Three-Day Mortal-Life Integration Verification

Status: PR candidate evidence for `feat/v2-multi-day-integration`.

## Scope

This slice adds no gameplay rule, schema field, service, scheduler, or background simulation. It verifies that the current first-settlement mortal-life loop remains playable while the existing shared World Clock advances lazily across three real-time-equivalent days.

The repository integration test advances the injected `now()` clock in twelve six-hour steps (72 hours total). Each step resolves elapsed Survival pressure through an authoritative scene request, then follows only existing legal actions:

1. continue the existing employer-backed carrying job;
2. earn the current deterministic wage;
3. buy one coarse bread and one drinking water;
4. consume both supplies;
5. travel to the legal lodging;
6. rest;
7. return to the workplace.

The test requires the character to remain below the current critical Survival threshold at every cycle, retain the same employment contract, never spend below zero, remain alive, preserve bounded request/event ledgers, and end at exactly 259,200 logical seconds. It also checks that repeated work has produced the already-defined public progression tag `搬運熟手` and career `聚落短工熟手`.

## Executed in the connected environment

The connected execution container still cannot obtain a complete repository checkout from GitHub, so the new repository integration test itself could not be executed end-to-end here.

Executed evidence:

- `tests/first-settlement-multi-day.test.mjs` exact candidate source: `node --check` **passed**.
- deterministic continuity arithmetic using the exact current Content Pack values and Survival intervals: **12/12 six-hour cycles passed**.
  - day 1 end: hunger 0, thirst 0, fatigue 1, money 0;
  - day 2 end: hunger 0, thirst 0, fatigue 1, money 0;
  - day 3 end: hunger 0, thirst 0, fatigue 1, money 0.
- the arithmetic harness verifies that no cycle reaches the current critical threshold 85 before work or after recovery and that money never becomes negative.

The relevant existing source contracts were also re-read before writing the test:

- World Clock resolves elapsed seconds lazily from `nowMs - lastResolvedAtMs` and adds them to logical time;
- Survival currently advances hunger every 30 minutes, thirst every 20 minutes, and fatigue every 60 minutes;
- first-settlement carrying work pays 2 and costs hunger +4, thirst +5, fatigue +2;
- bread costs 1 and reduces hunger by 30;
- drinking water costs 1 and reduces thirst by 30;
- lodging rest reduces fatigue by 25;
- square↔lodging travel adds only the existing route fatigue cost.

## Repository test added

`tests/first-settlement-multi-day.test.mjs`

The canonical repository suite must run this test through `npm run verify` in an environment with a real checkout. This document does **not** claim that full suite was rerun in the connected environment.

## Findings

The current minimum mortal-life economy can sustain this deterministic three-day routine without a soft-lock under the tested cadence. This is evidence for continuity of the current vertical slice, not proof of a complete long-term economy.

The test deliberately does not treat the current infinite development market stock, employer wage faucet, or instant request-driven rest as final economy/sleep design. Finite employer budgets, finite settlement inventory, schedules, richer sleep duration, offline occupation duty, weather, disease, and long-journey interruptions remain separate future rules and should not be smuggled into this verification slice.

## Free Resource Impact

No new persistent cost. No AI, database, queue, worker, scheduler, polling, background heartbeat, or external service was added.
