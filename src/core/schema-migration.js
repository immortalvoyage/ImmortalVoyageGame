import { CURRENT_SCHEMA_VERSION, cloneWorld } from './world-state.js';

const NEEDS = Object.freeze(['hunger', 'thirst', 'fatigue']);

export function migrateWorldState(input) {
  if (!input || typeof input !== 'object') throw new Error('invalid world state');
  if (!Number.isInteger(input.schemaVersion) || input.schemaVersion < 1) throw new Error('invalid world schema');
  if (input.schemaVersion > CURRENT_SCHEMA_VERSION) throw new Error('world schema is newer than runtime');

  let world = cloneWorld(input);
  while (world.schemaVersion < CURRENT_SCHEMA_VERSION) {
    if (world.schemaVersion === 1) {
      world = migrateV1ToV2(world);
      continue;
    }
    if (world.schemaVersion === 2) {
      world = migrateV2ToV3(world);
      continue;
    }
    if (world.schemaVersion === 3) {
      world = migrateV3ToV4(world);
      continue;
    }
    if (world.schemaVersion === 4) {
      world = migrateV4ToV5(world);
      continue;
    }
    if (world.schemaVersion === 5) {
      world = migrateV5ToV6(world);
      continue;
    }
    if (world.schemaVersion === 6) {
      world = migrateV6ToV7(world);
      continue;
    }
    if (world.schemaVersion === 7) {
      world = migrateV7ToV8(world);
      continue;
    }
    if (world.schemaVersion === 8) {
      world = migrateV8ToV9(world);
      continue;
    }
    throw new Error(`no world migration path from schema ${world.schemaVersion}`);
  }
  return world;
}

function migrateV1ToV2(world) {
  const migrated = cloneWorld(world);
  const characters = migrated.characters && typeof migrated.characters === 'object' ? migrated.characters : {};

  let inferredNextSequence = 1;
  for (const character of Object.values(characters)) {
    const match = /^char:(\d+)$/.exec(String(character?.id ?? ''));
    if (match) inferredNextSequence = Math.max(inferredNextSequence, Number(match[1]) + 1);

    if (!character || typeof character !== 'object') continue;
    character.needProgressSeconds ??= {};
    for (const need of NEEDS) {
      if (character.needProgressSeconds[need] === undefined) character.needProgressSeconds[need] = 0;
    }
  }

  const existingSequence = Number.isInteger(migrated.nextCharacterSequence) && migrated.nextCharacterSequence > 0
    ? migrated.nextCharacterSequence
    : 1;
  migrated.nextCharacterSequence = Math.max(existingSequence, inferredNextSequence);
  migrated.schemaVersion = 2;
  return migrated;
}

function migrateV2ToV3(world) {
  const migrated = cloneWorld(world);
  const characters = migrated.characters && typeof migrated.characters === 'object' ? migrated.characters : {};
  for (const character of Object.values(characters)) {
    if (!character || typeof character !== 'object') continue;
    character.behaviorCounts ??= {};
  }
  migrated.schemaVersion = 3;
  return migrated;
}

function migrateV3ToV4(world) {
  const migrated = cloneWorld(world);
  migrated.tradeListings ??= {};

  let inferredNextSequence = 1;
  for (const listingId of Object.keys(migrated.tradeListings)) {
    const match = /^listing:(\d+)$/.exec(listingId);
    if (match) inferredNextSequence = Math.max(inferredNextSequence, Number(match[1]) + 1);
  }
  const existingSequence = Number.isSafeInteger(migrated.nextTradeListingSequence) && migrated.nextTradeListingSequence > 0
    ? migrated.nextTradeListingSequence
    : 1;
  migrated.nextTradeListingSequence = Math.max(existingSequence, inferredNextSequence);
  migrated.schemaVersion = 4;
  return migrated;
}

function migrateV4ToV5(world) {
  const migrated = cloneWorld(world);
  migrated.archivedCharacters ??= {};
  migrated.estates ??= {};
  migrated.schemaVersion = 5;
  return migrated;
}

function migrateV5ToV6(world) {
  const migrated = cloneWorld(world);
  for (const collection of [migrated.characters, migrated.archivedCharacters]) {
    if (!collection || typeof collection !== 'object' || Array.isArray(collection)) continue;
    for (const character of Object.values(collection)) {
      if (!character || typeof character !== 'object' || Array.isArray(character)) continue;
      character.knowledgeIds ??= [];
    }
  }
  migrated.schemaVersion = 6;
  return migrated;
}

function migrateV6ToV7(world) {
  const migrated = cloneWorld(world);
  for (const collection of [migrated.characters, migrated.archivedCharacters]) {
    if (!collection || typeof collection !== 'object' || Array.isArray(collection)) continue;
    for (const character of Object.values(collection)) {
      if (!character || typeof character !== 'object' || Array.isArray(character)) continue;
      if (character.currentEmployment === undefined) character.currentEmployment = null;
    }
  }
  migrated.schemaVersion = 7;
  return migrated;
}

function migrateV7ToV8(world) {
  const migrated = cloneWorld(world);
  const currentLogicalTimeSeconds = Number.isSafeInteger(migrated.logicalTimeSeconds) && migrated.logicalTimeSeconds >= 0
    ? migrated.logicalTimeSeconds
    : 0;
  const characters = migrated.characters && typeof migrated.characters === 'object' && !Array.isArray(migrated.characters)
    ? migrated.characters
    : {};
  for (const character of Object.values(characters)) {
    if (!character || typeof character !== 'object' || Array.isArray(character)) continue;
    if (character.lastActiveLogicalTimeSeconds === undefined) {
      character.lastActiveLogicalTimeSeconds = currentLogicalTimeSeconds;
    }
    if (character.lastSurvivalResolvedLogicalTimeSeconds === undefined) {
      character.lastSurvivalResolvedLogicalTimeSeconds = currentLogicalTimeSeconds;
    }
  }
  migrated.schemaVersion = 8;
  return migrated;
}

function migrateV8ToV9(world) {
  const migrated = cloneWorld(world);
  migrated.pendingLives ??= {};
  migrated.schemaVersion = 9;
  return migrated;
}
