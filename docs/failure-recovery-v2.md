# V2 Failure Recovery Contract

This slice hardens the existing request-idempotent runtime against ambiguous transport and local-development persistence failures. It does not create a second transaction system, queue, worker, scheduler, or browser authority layer.

## Authority and retry boundary

`GameRuntime` remains authoritative. A successful request is recorded in the bounded server-side `requestResults` ledger before the world replacement is committed. Replaying the same `requestId` in the same session returns the recorded public result instead of executing the action again. A request ID reused by another session still fails with `REQUEST_ID_COLLISION`.

The Browser now treats network failures and HTTP 5xx responses as **uncertain**, not as proof that the world action failed. It performs at most two immediate attempts and reuses the exact serialized request body, including the same `requestId`. HTTP responses below 500 are definitive and are not retried by this helper.

When both bounded attempts remain uncertain, the Browser stores only the pending request ID and its already-selected structured action in `sessionStorage`. It does not invent or apply world state. Other player actions are blocked in that tab until the pending action is reconciled. A visible recovery control resubmits the exact pending action with the same request ID. On page reload in the same tab, the pending request is restored and receives one bounded recovery attempt before normal scene loading continues.

`narrative.scene` observation is excluded from pending-action blocking because it does not represent a player-authored world mutation and the UI has no world action to reconcile for it. A lost scene response may be requested again normally; the authoritative server still owns elapsed-time resolution and the request ledger.

Browser recovery state is deliberately bounded to one pending action and a maximum 12 KiB serialized action. Malformed or oversized stored recovery data is discarded. If browser storage is unavailable, recovery still works in-memory for the current page session; storage availability never changes server authority.

## FileGameStore ambiguity

The local-development `FileGameStore` continues to persist through write-to-temp followed by atomic rename. A storage exception can be ambiguous: the rename may have committed the new file before the caller observes an error.

On **any** replacement failure, the adapter now discards its in-memory world cache and best-effort removes the temporary file before rethrowing the original error. The next transaction reloads the authoritative file from disk. Therefore:

- failure before rename: disk remains at the prior world; retrying the same request ID executes once and commits once;
- error observed after rename: disk already contains the committed request result; retrying the same request ID reloads disk and returns the cached result without applying the mutation twice.

This behavior is intentionally local-store recovery logic. Production persistence must provide its own atomic/transactional adapter contract and must not infer successful commit from an exception.

## Gameplay recovery path

Failure Recovery also verifies that the first-settlement mortal loop is not a deterministic soft-lock when a character has zero money and all current Survival needs are already critical. A matching employed character cannot work while critical, and the rejected work request produces no authoritative mutation. Public routes still permit reaching free food, free maintained water, and a legal rest location. After those deterministic recovery actions reduce all critical needs, the same valid employment can resume work and earn money again.

This is not an automatic rescue, free teleport, hidden subsidy, or death override. The player still performs normal authoritative actions and pays validated route costs. The purpose is to prove that the current pressure rules retain at least one legitimate recovery route.

## Explicitly not included

- no unbounded retry loop, polling, heartbeat, background worker, or scheduled recovery job;
- no client-side rollback or optimistic authoritative state;
- no automatic compensation payment/item grant;
- no persistence database or external queue;
- no AI call;
- no new world schema field;
- no attempt to make the development file store a production multi-process database.

## Free-First impact

All recovery is request-driven. Normal idle compute remains zero, and this slice adds no external service or persistent runtime cost.
