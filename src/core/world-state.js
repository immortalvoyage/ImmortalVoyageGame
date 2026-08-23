export const CURRENT_SCHEMA_VERSION = 1;
export const MAX_REQUEST_RESULTS = 256;
export const MAX_GAME_EVENTS = 256;

export function createInitialWorld({ nowMs = Date.now() } = {}) {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    worldId: 'v2-dev-world',
    logicalTimeSeconds: 0,
    lastResolvedAtMs: nowMs,
    characters: {},
    requestResults: {},
    requestOrder: [],
    gameEvents: [],
  };
}

export function cloneWorld(world) {
  return structuredClone(world);
}

export function assertWorldState(world) {
  if (!world || world.schemaVersion !== CURRENT_SCHEMA_VERSION) throw new Error('unsupported world schema');
  if (!world.characters || typeof world.characters !== 'object') throw new Error('invalid character collection');
  if (!world.requestResults || typeof world.requestResults !== 'object') throw new Error('invalid request result ledger');
  if (!Array.isArray(world.requestOrder) || !Array.isArray(world.gameEvents)) throw new Error('invalid world ledgers');
  return world;
}

export function rememberRequest(world, { requestId, sessionId, result }) {
  world.requestResults[requestId] = { sessionId, result };
  world.requestOrder.push(requestId);
  while (world.requestOrder.length > MAX_REQUEST_RESULTS) {
    const expired = world.requestOrder.shift();
    delete world.requestResults[expired];
  }
}

export function recordGameEvents(world, events = []) {
  for (const event of events) {
    if (!event || typeof event.type !== 'string') throw new Error('invalid game event');
    world.gameEvents.push({
      type: event.type,
      logicalTimeSeconds: world.logicalTimeSeconds,
      data: structuredClone(event.data ?? null),
    });
  }
  if (world.gameEvents.length > MAX_GAME_EVENTS) {
    world.gameEvents.splice(0, world.gameEvents.length - MAX_GAME_EVENTS);
  }
}
