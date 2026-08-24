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
