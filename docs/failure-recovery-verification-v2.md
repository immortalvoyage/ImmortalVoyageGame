# V2 Failure Recovery Verification

Status: PR candidate evidence for `feat/v2-failure-recovery`.

## Executed in the connected environment

The execution container still cannot clone GitHub directly, so the complete repository checkout suite was not rerun here. The following isolated semantic harnesses were executed against the branch logic:

- Browser action retry helper: **8/8 passed**
  - transport error then success reuses the exact request body/request ID;
  - HTTP 5xx then success reuses the exact request body/request ID;
  - malformed HTTP 2xx is treated as ambiguous and retried with the same request ID;
  - valid JSON with an invalid successful result shape is also treated as ambiguous and retried with the same request ID;
  - repeated malformed HTTP 2xx remains explicitly unconfirmed;
  - HTTP 4xx is definitive and is not retried;
  - repeated transport failure stops after two attempts;
  - configured attempt count is hard-bounded to 1–3.
- Pending action reload state: **4/4 passed**
  - request ID/action round-trip through bounded browser storage;
  - confirmed action clears recovery state;
  - malformed stored state is discarded;
  - unavailable storage degrades without changing server authority.
- FileGameStore ambiguous replace harness: **2/2 passed**
  - failure before rename leaves the authoritative file unchanged, and a same-ID retry commits once;
  - error observed after rename reloads the already-committed request ledger, and a same-ID retry does not write or mutate twice.
- Player-facing recovery result formatter: **2/2 passed**.
- Browser recovery-flow syntax check: **passed**.

## Repository tests added

The branch also adds repository-level tests that should run under canonical `npm run verify` in a real checkout:

- `tests/action-client-recovery.test.mjs`
- `tests/action-recovery-state.test.mjs`
- `tests/file-store-recovery.test.mjs`
- `tests/failure-recovery-server.test.mjs`
- `tests/failure-recovery-result-message.test.mjs`
- `tests/first-settlement-failure-recovery.test.mjs`

`tests/first-settlement-server.test.mjs` is extended to require the two new static browser recovery modules to be served successfully.

The HTTP recovery test injects an error *after* the development file rename has committed, expects the first `/api/action` response to be `500 INTERNAL_ERROR`, retries the exact same body/request ID, and requires a `200` cached `CHARACTER_BORN` result with one character, one request-ledger entry, one birth event, and one rename only.

The first-settlement failure-recovery integration test starts from zero money and critical hunger/thirst/fatigue with a valid employment contract. Critical work must fail with zero mutation. The character must then remain able to reach/gather/consume free food, reach/gather/consume maintained water, use the legal lodging rest action, leave critical condition, return to the workplace, and earn again.

## Verification limitation

Do **not** interpret the targeted harnesses as a replacement for repository-wide verification. Canonical completion evidence remains `npm run verify` from a real repository checkout. No GitHub Actions workflow was added or invoked for this slice.

## Cost verification

No database, queue, scheduler, worker, polling loop, AI provider, external storage, or paid service was added. Browser retries are bounded and occur only in direct response to the player's request or explicit recovery action/page reload.
