import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeveloperTestSession } from '../src/core/auth-session.js';
import { LOCAL_DEVELOPMENT_ENVIRONMENT } from '../src/core/runtime-environment.js';
import { assertWorldState } from '../src/core/world-state.js';
import { migrateWorldState } from '../src/core/schema-migration.js';
import { validateContentPack } from '../src/content/validate-content-pack.js';
import { devStarterPack } from '../src/content/dev-starter.js';
import { firstSettlementPack } from '../src/content/first-settlement.js';
import { createDevelopmentGame } from '../src/game.js';
import { settleCharacterDeath } from '../src/modules/estate/index.js';

function actor(accountId, sessionId) {
  return createDeveloperTestSession({
    environment: LOCAL_DEVELOPMENT_ENVIRONMENT,
    accountId,
    sessionId,
  }).actor;
}

function dispatch(runtime, acting, requestId, type, payload = {}) {
  return runtime.dispatch({ actor: acting, requestId, action: { type, payload } });
}

test('formal birth consumes one Pending Life and preserves immutable birth truth on the character', async () => {
  const { runtime, store } = createDevelopmentGame({
    now: () => 1000,
    contentPack: firstSettlementPack,
    lifeBirthPolicy: 'pending-required',
  });
  const alice = actor('account:alice', 'session:alice');

  const bypass = await dispatch(runtime, alice, 'direct-bypass', 'character.birth', { name: 'Bypass' });
  assert.equal(bypass.code, 'FORMAL_BIRTH_REQUIRED');
  assert.deepEqual(store.snapshot().characters, {});

  const beforePendingOptions = await dispatch(runtime, alice, 'options-before-pending', 'life.observe-birth-options');
  assert.equal(beforePendingOptions.code, 'PENDING_LIFE_REQUIRED');

  const pending = await dispatch(runtime, alice, 'pending', 'life.create-pending');
  assert.equal(pending.code, 'PENDING_LIFE_CREATED');
  const birthWorldInstant = pending.data.pendingLife.birthWorldInstant;

  const options = await dispatch(runtime, alice, 'options', 'life.observe-birth-options');
  assert.equal(options.code, 'BIRTH_OPTIONS_READY');
  assert.deepEqual(options.data.options.map((option) => option.id), ['first-square']);
  assert.equal(typeof options.data.options[0].name, 'string');
  assert.equal(typeof options.data.options[0].description, 'string');

  const beforeInvalid = store.snapshot();
  const invalidLocation = await dispatch(runtime, alice, 'bad-location', 'life.formal-birth', {
    name: 'Formal Alice',
    birthLocationId: 'forged-location',
  });
  assert.equal(invalidLocation.code, 'BIRTH_LOCATION_NOT_AVAILABLE');
  assert.deepEqual(store.snapshot(), beforeInvalid);

  const born = await dispatch(runtime, alice, 'formal-birth', 'life.formal-birth', {
    name: 'Formal Alice',
    birthLocationId: 'first-square',
  });
  assert.equal(born.code, 'FORMAL_LIFE_BORN');
  assert.equal(Object.hasOwn(born.data.character, 'ownerAccountId'), false);
  assert.equal(Object.hasOwn(born.data.character, 'birthWorldInstant'), false);

  const world = store.snapshot();
  const character = world.characters['session:alice'];
  assert.equal(character.ownerAccountId, 'account:alice');
  assert.deepEqual(character.birthWorldInstant, birthWorldInstant);
  assert.equal(character.locationId, 'first-square');
  assert.equal(world.pendingLives['account:alice'], undefined);

  const replay = await dispatch(runtime, alice, 'formal-birth', 'life.formal-birth', {
    name: 'ignored-on-replay',
    birthLocationId: 'first-square',
  });
  assert.deepEqual(replay, born);
  assert.equal(store.snapshot().nextCharacterSequence, world.nextCharacterSequence);
});

test('one account cannot create another Pending Life while active, but death permits a new birth instant', async () => {
  let now = 1000;
  const { runtime, store } = createDevelopmentGame({
    now: () => now,
    contentPack: firstSettlementPack,
    lifeBirthPolicy: 'pending-required',
  });
  const firstSession = actor('account:cycle', 'session:first');
  const rotatedSession = actor('account:cycle', 'session:rotated');

  const firstPending = await dispatch(runtime, firstSession, 'cycle-pending-1', 'life.create-pending');
  await dispatch(runtime, firstSession, 'cycle-birth-1', 'life.formal-birth', {
    name: 'Cycle One',
    birthLocationId: 'first-square',
  });
  const activeBlock = await dispatch(runtime, rotatedSession, 'cycle-pending-blocked', 'life.create-pending');
  assert.equal(activeBlock.code, 'ACTIVE_LIFE_EXISTS');
  assert.deepEqual(store.snapshot().pendingLives, {});

  now += 60 * 60 * 1000;
  await dispatch(runtime, firstSession, 'advance-before-death', 'narrative.scene');
  const deathWorld = store.snapshot();
  const firstCharacter = deathWorld.characters['session:first'];
  const settled = settleCharacterDeath({
    world: deathWorld,
    sessionId: 'session:first',
    characterId: firstCharacter.id,
    causeCode: 'test.lifecycle',
  });
  assert.equal(settled.code, 'ESTATE_OPENED');
  await store.replace(deathWorld);
  assert.equal(deathWorld.archivedCharacters[firstCharacter.id].ownerAccountId, 'account:cycle');
  assert.deepEqual(deathWorld.archivedCharacters[firstCharacter.id].birthWorldInstant, firstPending.data.pendingLife.birthWorldInstant);

  const secondPending = await dispatch(runtime, rotatedSession, 'cycle-pending-2', 'life.create-pending');
  assert.equal(secondPending.code, 'PENDING_LIFE_CREATED');
  assert.equal(secondPending.data.pendingLife.birthWorldInstant.offsetSeconds, 60 * 60);
  assert.notDeepEqual(secondPending.data.pendingLife.birthWorldInstant, firstPending.data.pendingLife.birthWorldInstant);

  const secondBirth = await dispatch(runtime, rotatedSession, 'cycle-birth-2', 'life.formal-birth', {
    name: 'Cycle Two',
    birthLocationId: 'first-square',
  });
  assert.equal(secondBirth.code, 'FORMAL_LIFE_BORN');
  assert.equal(store.snapshot().characters['session:rotated'].ownerAccountId, 'account:cycle');
});

test('schema v9 migrates active and archived Life identity fields to explicit null without guessing account ownership', async () => {
  const activeGame = createDevelopmentGame({ now: () => 1000 });
  const legacyActor = actor('account:legacy', 'legacy-session');
  await dispatch(activeGame.runtime, legacyActor, 'legacy-birth', 'character.birth', { name: 'Legacy' });
  const v9Active = activeGame.store.snapshot();
  v9Active.schemaVersion = 9;
  delete v9Active.characters['legacy-session'].ownerAccountId;
  delete v9Active.characters['legacy-session'].birthWorldInstant;
  const migratedActive = migrateWorldState(v9Active);
  assert.equal(migratedActive.schemaVersion, 10);
  assert.equal(migratedActive.characters['legacy-session'].ownerAccountId, null);
  assert.equal(migratedActive.characters['legacy-session'].birthWorldInstant, null);
  assertWorldState(migratedActive);

  const archiveWorld = activeGame.store.snapshot();
  const archivedId = archiveWorld.characters['legacy-session'].id;
  settleCharacterDeath({ world: archiveWorld, sessionId: 'legacy-session', characterId: archivedId, causeCode: 'test.legacy' });
  archiveWorld.schemaVersion = 9;
  delete archiveWorld.archivedCharacters[archivedId].ownerAccountId;
  delete archiveWorld.archivedCharacters[archivedId].birthWorldInstant;
  const migratedArchive = migrateWorldState(archiveWorld);
  assert.equal(migratedArchive.archivedCharacters[archivedId].ownerAccountId, null);
  assert.equal(migratedArchive.archivedCharacters[archivedId].birthWorldInstant, null);
  assertWorldState(migratedArchive);
});

test('Life invariants reject duplicate account lives and pending-active overlap', async () => {
  const { runtime, store } = createDevelopmentGame({
    now: () => 1000,
    contentPack: firstSettlementPack,
    lifeBirthPolicy: 'pending-required',
  });
  const alice = actor('account:invariant', 'session:a');
  await dispatch(runtime, alice, 'inv-pending', 'life.create-pending');
  await dispatch(runtime, alice, 'inv-birth', 'life.formal-birth', { name: 'Invariant', birthLocationId: 'first-square' });

  const duplicate = store.snapshot();
  duplicate.characters['session:b'] = structuredClone(duplicate.characters['session:a']);
  duplicate.characters['session:b'].id = 'char:999';
  duplicate.characters['session:b'].ownerSessionId = 'session:b';
  assert.throws(() => assertWorldState(duplicate), /duplicate active account life/);

  const overlap = store.snapshot();
  overlap.pendingLives['account:invariant'] = {
    ownerAccountId: 'account:invariant',
    status: 'pending',
    birthWorldInstant: structuredClone(overlap.characters['session:a'].birthWorldInstant),
    createdLogicalTimeSeconds: 0,
  };
  assert.throws(() => assertWorldState(overlap), /pending and active life/);
});

test('birthLocations are optional for non-formal packs but fail closed when configured incorrectly', () => {
  assert.doesNotThrow(() => validateContentPack(devStarterPack));

  const empty = structuredClone(devStarterPack);
  empty.birthLocations = [];
  assert.throws(() => validateContentPack(empty), /birthLocations must not be empty/);

  const duplicate = structuredClone(devStarterPack);
  duplicate.birthLocations = ['starter-square', 'starter-square'];
  assert.throws(() => validateContentPack(duplicate), /duplicate value/);

  const unknown = structuredClone(devStarterPack);
  unknown.birthLocations = ['missing-location'];
  assert.throws(() => validateContentPack(unknown), /references unknown location/);
});
