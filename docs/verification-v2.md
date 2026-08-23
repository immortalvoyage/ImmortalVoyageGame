# V2 verification

Local verification for the first rewrite slice:

- `npm test`: 10 tests passed.
- `node --check`: all JavaScript and MJS sources passed syntax validation.
- Browser/server smoke coverage verifies that the UI reaches the game only through the server action endpoint and receives a server-issued HttpOnly session cookie.

Coverage includes normal flow, invalid movement, unauthenticated access, idempotent retries, request-id collision isolation, feature/module off behavior, lazy elapsed world resolution, bounded idempotency storage, economy source/sink evidence, and local HTTP boundary behavior.
