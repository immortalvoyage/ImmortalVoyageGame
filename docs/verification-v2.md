# V2 verification

## Canonical local check

Run:

```bash
npm run verify
```

The verification runner uses only Node.js built-ins. It performs `node --check` over JavaScript/MJS files in `src/`, `dev/`, `public/`, `tests/`, and `scripts/`, then runs the complete `node --test` suite. This is the preferred local completion check before claiming a future branch fully verified.

## Evidence history

- PR #60: last complete repository suite executed in the available development environment — 16 tests passed and all JavaScript/MJS syntax checks passed.
- PR #61: exact-source targeted schema migration harness — 7/7 passed; changed core files passed `node --check`.
- PR #62: exact-source targeted Purpose Action harness — 3/3 passed; Location/Purpose/Narrative passed `node --check`.
- PR #63: exact-source deterministic result-message tests — 4/4 passed; `public/result-message.js` passed `node --check`.
- `scripts/verify.mjs`: exact script logic was exercised in an isolated zero-dependency Node fixture and successfully performed syntax checks plus a complete test run.

The connected execution environment cannot directly clone this private repository, so targeted evidence after PR #60 must not be presented as a full repository-suite rerun. A future environment with the repository checked out should use `npm run verify` and record that result.

## Coverage areas already represented

Coverage includes the critical playable loop, invalid movement, unauthenticated access, idempotent retries, request-id collision isolation, module-off degradation, lazy elapsed world resolution, fractional survival progress, bounded idempotency storage, economy source/sink evidence, local persistence and corruption fail-closed behavior, schema migration, Purpose Action privacy/boundary behavior, server/browser separation, and deterministic player-facing result feedback.
