# V2 Architecture Notes

This rewrite keeps the authoritative game runtime on the server side and treats browser output as untrusted presentation/input only.

## Current boundaries

- Core: world clock, world state, action resolution, module manifest validation, permission boundary, bounded idempotency/event ledgers.
- Modules: character, inventory, location, NPC, survival, economy.
- Content: disposable versioned starter content used only to prove the critical path.
- Browser: submits intents through `/api/action`; it does not import Core modules or own world truth.
- Local dev server: zero-dependency Node server with in-memory storage for development only.

## Cost model

No background worker, polling loop, database, AI provider, queue, analytics service, or production deployment is required for the current slice. World progression uses logical time plus lazy elapsed resolution on the next authoritative request.

## Deferred production adapters

Persistent storage, real authentication/session, production serverless adapter, schema migrations beyond v1, and platform-level Event Bus/Registry/Feature Flag contracts remain intentionally deferred until their concrete integration is required.
