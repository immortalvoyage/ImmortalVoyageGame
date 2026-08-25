export const CURRENT_SCHEMA_VERSION = 8;
export const MAX_REQUEST_RESULTS = 256;
export const MAX_GAME_EVENTS = 256;
export const MAX_TRADE_LISTINGS = 50;
export const MAX_CHARACTER_KNOWLEDGE = 128;

const NEED_KEYS = Object.freeze(['hunger', 'thirst', 'fatigue']);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyText(value) {
  return typeof value === 'string' && value.length > 0;
}

function assertNeedsAndBehavior(character) {
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
}

function assertKnowledgeIds(character) {
  if (!Array.isArray(character.knowledgeIds)) throw new Error('invalid character knowledge');
  if (character.knowledgeIds.length > MAX_CHARACTER_KNOWLEDGE) throw new Error('character knowledge exceeds limit');
  const seen = new Set();
  for (const knowledgeId of character.knowledgeIds) {
    if (!isNonEmptyText(knowledgeId) || seen.has(knowledgeId)) throw new Error('invalid character knowledge');
    seen.add(knowledgeId);
  }
}

function assertCurrentEmployment(character) {
  const employment = character.currentEmployment;
  if (employment === null) return;
  if (!isRecord(employment)
    || !isNonEmptyText(employment.jobId)
    || !isNonEmptyText(employment.employerNpcId)
    || !isNonEmptyText(employment.workLocationId)) {
    throw new Error('invalid current employment');
  }
}

function assertLastActiveLogicalTime(character, worldLogicalTimeSeconds) {
  const value = character.lastActiveLogicalTimeSeconds;
  if (!Number.isSafeInteger(value) || value < 0 || value > worldLogicalTimeSeconds) {
    throw new Error('invalid character activity time');
  }
}

function assertInventory(inventory, label = 'inventory') {
  if (!isRecord(inventory)) throw new Error(`invalid ${label} state`);
  for (const [itemId, quantity] of Object.entries(inventory)) {
    if (!isNonEmptyText(itemId) || !Number.isSafeInteger(quantity) || quantity < 1) throw new Error(`invalid ${label} state`);
  }
}

function assertCharacterState(sessionId, character, worldLogicalTimeSeconds) {
  if (!isNonEmptyText(sessionId) || !isRecord(character)) throw new Error('invalid character state');
  if (!isNonEmptyText(character.id) || character.ownerSessionId !== sessionId) throw new Error('invalid character ownership');
  if (!isNonEmptyText(character.name) || character.name.length > 24) throw new Error('invalid character identity');
  if (character.status !== 'alive' || !isNonEmptyText(character.locationId)) throw new Error('invalid character state');

  assertNeedsAndBehavior(character);
  assertKnowledgeIds(character);
  assertCurrentEmployment(character);
  assertLastActiveLogicalTime(character, worldLogicalTimeSeconds);
  assertInventory(character.inventory);
  if (!Number.isSafeInteger(character.money) || character.money < 0) throw new Error('invalid money state');
}

function assertArchiveAndEstateState(world) {
  if (!isRecord(world.archivedCharacters)) throw new Error('invalid character archive');
  if (!isRecord(world.estates)) throw new Error('invalid estate collection');

  const activeCharacterIds = new Set(Object.values(world.characters).map((character) => character.id));
  for (const [characterId, archived] of Object.entries(world.archivedCharacters)) {
    if (!isNonEmptyText(characterId) || !isRecord(archived) || archived.id !== characterId) throw new Error('invalid archived character');
    if (activeCharacterIds.has(characterId)) throw new Error('character cannot be active and archived');
    if (!isNonEmptyText(archived.ownerSessionId)) throw new Error('invalid archived character owner');
    if (!isNonEmptyText(archived.name) || archived.name.length > 24) throw new Error('invalid archived character identity');
    if (archived.status !== 'dead' || !isNonEmptyText(archived.locationId)) throw new Error('invalid archived character state');
    assertNeedsAndBehavior(archived);
    assertKnowledgeIds(archived);
    assertCurrentEmployment(archived);
    if (Object.hasOwn(archived, 'inventory') || Object.hasOwn(archived, 'money')) throw new Error('archived character duplicates estate assets');
    if (!isNonEmptyText(archived.estateId) || !isNonEmptyText(archived.deathCauseCode)) throw new Error('invalid archived character death');
    if (!Number.isSafeInteger(archived.diedLogicalTimeSeconds)
      || archived.diedLogicalTimeSeconds < 0
      || archived.diedLogicalTimeSeconds > world.logicalTimeSeconds) {
      throw new Error('invalid archived character death time');
    }

    const estate = world.estates[archived.estateId];
    if (!estate || estate.deceasedCharacterId !== characterId) throw new Error('archived character estate mismatch');
  }

  for (const [estateId, estate] of Object.entries(world.estates)) {
    if (!isNonEmptyText(estateId) || !isRecord(estate) || estate.id !== estateId) throw new Error('invalid estate');
    if (estate.status !== 'pending') throw new Error('invalid estate status');
    if (!isNonEmptyText(estate.deceasedCharacterId)) throw new Error('invalid estate owner');
    const archived = world.archivedCharacters[estate.deceasedCharacterId];
    if (!archived || archived.estateId !== estateId) throw new Error('estate archive mismatch');
    if (!Number.isSafeInteger(estate.openedLogicalTimeSeconds)
      || estate.openedLogicalTimeSeconds < 0
      || estate.openedLogicalTimeSeconds > world.logicalTimeSeconds) {
      throw new Error('invalid estate time');
    }
    if (!Number.isSafeInteger(estate.money) || estate.money < 0) throw new Error('invalid estate money');
    assertInventory(estate.inventory, 'estate inventory');
  }
}

function assertTradeState(world) {
  if (!isRecord(world.tradeListings)) throw new Error('invalid trade listing collection');
  if (!Number.isSafeInteger(world.nextTradeListingSequence) || world.nextTradeListingSequence < 1) {
    throw new Error('invalid trade listing sequence');
  }
  const entries = Object.entries(world.tradeListings);
  if (entries.length > MAX_TRADE_LISTINGS) throw new Error('trade listing collection exceeds limit');

  let highestSequence = 0;
  for (const [listingId, listing] of entries) {
    if (!isNonEmptyText(listingId) || !isRecord(listing) || listing.id !== listingId) {
      throw new Error('invalid trade listing');
    }
    const sequenceMatch = /^listing:(\d+)$/.exec(listingId);
    if (!sequenceMatch) throw new Error('invalid trade listing id');
    const sequence = Number(sequenceMatch[1]);
    if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error('invalid trade listing id');
    highestSequence = Math.max(highestSequence, sequence);

    if (!isNonEmptyText(listing.sellerSessionId) || !isNonEmptyText(listing.sellerCharacterId)) {
      throw new Error('invalid trade seller');
    }
    const seller = world.characters[listing.sellerSessionId];
    if (!seller || seller.id !== listing.sellerCharacterId) throw new Error('invalid trade seller');
    if (!isNonEmptyText(listing.itemId)) throw new Error('invalid trade item');
    if (!Number.isSafeInteger(listing.quantity) || listing.quantity < 1) throw new Error('invalid trade quantity');
    if (!Number.isSafeInteger(listing.totalPrice) || listing.totalPrice < 1) throw new Error('invalid trade price');
    if (!Number.isSafeInteger(listing.createdLogicalTimeSeconds)
      || listing.createdLogicalTimeSeconds < 0
      || listing.createdLogicalTimeSeconds > world.logicalTimeSeconds) {
      throw new Error('invalid trade listing time');
    }
  }

  if (world.nextTradeListingSequence <= highestSequence) throw new Error('invalid trade listing sequence');
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
    archivedCharacters: {},
    estates: {},
    nextCharacterSequence: 1,
    tradeListings: {},
    nextTradeListingSequence: 1,
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

  const activeIds = new Set();
  for (const [sessionId, character] of Object.entries(world.characters)) {
    assertCharacterState(sessionId, character, world.logicalTimeSeconds);
    if (activeIds.has(character.id)) throw new Error('duplicate active character id');
    activeIds.add(character.id);
  }
  assertArchiveAndEstateState(world);
  assertTradeState(world);
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
