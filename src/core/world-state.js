export const CURRENT_SCHEMA_VERSION = 3;
export const MAX_REQUEST_RESULTS = 256;
export const MAX_GAME_EVENTS = 256;

const NEED_KEYS = Object.freeze(['hunger', 'thirst', 'fatigue']);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyText(value) {
  return typeof value === 'string' && value.length > 0;
}

function assertCharacterState(sessionId, character) {
  if (!isNonEmptyText(sessionId) || !isRecord(character)) throw new Error('invalid character state');
  if (!isNonEmptyText(character.id) || character.ownerSessionId !== sessionId) throw new Error('invalid character ownership');
  if (!isNonEmptyText(character.name) || character.name.length > 24) throw new Error('invalid character identity');
  if (!isNonEmptyText(character.status) || !isNonEmptyText(character.locationId)) throw new Error('invalid character state');

  if (!isRecord(character.needs)) throw new Error('invalid survival needs');
  if (!isRecord(character.needProgressSeconds)) throw new Error('invalid survival progress');
  for (const need of NEED_KEYS) {
    const value = character.needs[need];
    if (!Number.isSafeInteger(value) || value < 0 || value > 100) throw new Error('invalid survival needs');
    const progress = character.needProgressSeconds[need];
    if (!Number.isSafeInteger(progress) || progress < 0) throw new Error('invalid survival progress');
  }

  if (!isRecord(character.behaviorCounts)) throw new Error('invalid behavior counts');
  for (const [behaviorId, count] of Object.entries(character.behaviorCounts)) {
    if (!isNonEmptyText(behaviorId) || !Number.isSafeInteger(count) || count < 0) throw new Error('invalid behavior counts');
  }

  if (!isRecord(character.inventory)) throw new Error('invalid inventory state');
  for (const [itemId, quantity] of Object.entries(character.inventory)) {
    if (!isNonEmptyText(itemId) || !Number.isSafeInteger(quantity) || quantity < 1) throw new Error('invalid inventory state');
  }

  if (!Number.isSafeInteger(character.money) || character.money < 0) throw new Error('invalid money state');
}

function assertRequestLedger(world) {
  if (!isRecord(world.requestResults) || !Array.isArray(world.requestOrder)) throw new Error('invalid request result ledger');
  if (world.requestOrder.length > MAX_REQUEST_RESULTS || Object.keys(world.requestResults).length > MAX_REQUEST_RESULTS) {
    throw new Error('request result ledger exceeds limit');
  }

  const ordered = new Set();
  for (const requestId of world.requestOrder) {
    if (!isNonEmptyText(requestId) || ordered.has(requestId) || !Object.hasOwn(world.requestResults, requestId)) {
      throw new Error('invalid request result ledger');
    }
    ordered.add(requestId);
  }
  for (const [requestId, entry] of Object.entries(world.requestResults)) {
    if (!ordered.has(requestId) || !isRecord(entry) || !isNonEmptyText(entry.sessionId) || !isRecord(entry.result)) {
      throw new Error('invalid request result ledger');
    }
  }
}

function assertGameEventLedger(world) {
  if (!Array.isArray(world.gameEvents)) throw new Error('invalid game event ledger');
  if (world.gameEvents.length > MAX_GAME_EVENTS) throw new Error('game event ledger exceeds limit');
  for (const event of world.gameEvents) {
    if (!isRecord(event) || !isNonEmptyText(event.type)) throw new Error('invalid game event');
    if (!Number.isSafeInteger(event.logicalTimeSeconds) || event.logicalTimeSeconds < 0 || event.logicalTimeSeconds > world.logicalTimeSeconds) {
      throw new Error('invalid game event time');
    }
  }
}

export function createInitialWorld({ nowMs = Date.now() } = {}) {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    worldId: 'v2-dev-world',
    logicalTimeSeconds: 0,
    lastResolvedAtMs: nowMs,
    characters: {},
    nextCharacterSequence: 1,
    requestResults: {},
    requestOrder: [],
    gameEvents: [],
  };
}

export function cloneWorld(world) {
  return structuredClone(world);
}

export function assertWorldState(world) {
  if (!isRecord(world) || world.schemaVersion !== CURRENT_SCHEMA_VERSION) throw new Error('unsupported world schema');
  if (!isNonEmptyText(world.worldId)) throw new Error('invalid world identity');
  if (!Number.isSafeInteger(world.logicalTimeSeconds) || world.logicalTimeSeconds < 0) throw new Error('invalid logical world time');
  if (!Number.isFinite(world.lastResolvedAtMs) || world.lastResolvedAtMs < 0) throw new Error('invalid world timestamp');
  if (!isRecord(world.characters)) throw new Error('invalid character collection');
  if (!Number.isSafeInteger(world.nextCharacterSequence) || world.nextCharacterSequence < 1) throw new Error('invalid character sequence');

  for (const [sessionId, character] of Object.entries(world.characters)) assertCharacterState(sessionId, character);
  assertRequestLedger(world);
  assertGameEventLedger(world);
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
