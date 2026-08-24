# First Settlement V2 targeted verification

This file records evidence run for the first formal-life Content Pack candidate and location-scoped rest slice. It does not claim a complete private-repository `npm run verify` rerun.

## Executed targeted evidence

- First-settlement Content Pack + rest-contract validator harness: **7/7 passed**. Covered pack validation, four-location topology, three exits from the settlement entry, two employer-backed jobs, legal rest presence, malformed empty rest label rejection, and wrong rest shape rejection.
- Location-rest Survival semantic harness: **4/4 passed**. Covered unavailable-rest zero mutation, legal rest deterministic fatigue relief, lower bound at zero, and no-active-character rejection. Exact Survival source used by the harness passed `node --check`.
- First-settlement Situation harness: **3/3 passed**. Covered unemployed employer offer, employed work opportunity, bounded primary options, and critical-survival retention of a route to the legal lodging while work is hidden. Exact Situation source used by the harness passed `node --check`.
- First-settlement action integration harness: **5/5 passed** across exact Employment/Economy/Location/Survival action source with minimal boundary stubs. Flow: forged work rejected → accept employer → work/pay → buy/eat food → resign → travel/get/drink water → travel to lodging → accept second employer → work → legal rest.
- Rest result-message formatter harness: **2/2 passed** for safe unavailable-rest failure and deterministic rest success text.

## Repository tests added

- `tests/first-settlement.test.mjs`: validates the topology and runs the mortal livelihood loop through `createDevelopmentGame({ contentPack: firstSettlementPack })`, including public-contract privacy and zero-AI deterministic Narrative.
- `tests/rest-location-policy.test.mjs`: validates the location rest contract, zero-mutation unavailable rest, Narrative utility gating, deterministic relief, and dev-starter regression rest locations.
- `tests/rest-result-message.test.mjs`: checks the player-safe failure message.
- `tests/first-settlement-server.test.mjs`: runs the candidate through the file-backed dev-server action boundary.

## Limitation

The connected execution container still has no outbound GitHub network access, so it cannot clone the repository and run the canonical `npm run verify` suite from a real checkout. The full repository suite must not be described as rerun here. The targeted harnesses above are the executed evidence for this slice.
