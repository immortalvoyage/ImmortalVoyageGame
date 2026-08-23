import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevelopmentGame } from '../src/game.js';
import { MAX_REQUEST_RESULTS } from '../src/core/world-state.js';

const actor = { sessionId: 's1' };

async function dispatch(runtime, requestId, type, payload, acting = actor) {
  return runtime.dispatch({ actor: acting, requestId, action: { type, payload } });
}

test('birth creates one owned character', async () => {
  const { runtime, store } = createDevelopmentGame({ now: () => 1000 });
  const result = await dispatch(runtime, 'r1', 'character.birth', { name: '旅人' });
  assert.equal(result.ok, true);
  assert.equal(result.data.character.ownerSessionId, undefined);
  assert.equal(result.data.character.needProgressSeconds, undefined);
  assert.equal(result.data.character.id, 'char:1');
  assert.equal(store.snapshot().characters.s1.name, '旅人');
  assert.equal((await dispatch(runtime, 'r2', 'character.birth', { name: '二號' })).code, 'CHARACTER_EXISTS');
});

test('request ids are idempotent and cannot be stolen by another session', async () => {
  const { runtime, store } = createDevelopmentGame({ now: () => 1000 });
  const first = await dispatch(runtime, 'same', 'character.birth', { name: '旅人' });
  const replay = await dispatch(runtime, 'same', 'character.birth', { name: '不同名字' });
  assert.deepEqual(replay, first);
  assert.equal(store.snapshot().characters.s1.name, '旅人');
  const collision = await dispatch(runtime, 'same', 'character.birth', { name: '偷用' }, { sessionId: 's2' });
  assert.equal(collision.code, 'REQUEST_ID_COLLISION');
});

test('critical path supports observe, npc interaction, travel, gather, consume, earn and spend', async () => {
  const { runtime } = createDevelopmentGame({ now: () => 1000 });
  await dispatch(runtime, 'b', 'character.birth', { name: '旅人' });
  const observed = await dispatch(runtime, 'o', 'location.observe');
  assert.equal(observed.data.visibleNpcs[0].id, 'foreman');
  assert.equal((await dispatch(runtime, 'n', 'npc.interact', { npcId: 'foreman' })).ok, true);
  assert.equal((await dispatch(runtime, 't1', 'location.travel', { destinationId: 'starter-well' })).ok, true);
  assert.equal((await dispatch(runtime, 'g1', 'survival.gather', { kind: 'water' })).ok, true);
  assert.equal((await dispatch(runtime, 'c1', 'survival.consume', { kind: 'water' })).ok, true);
  await dispatch(runtime, 't2', 'location.travel', { destinationId: 'starter-square' });
  assert.equal((await dispatch(runtime, 'w1', 'economy.work')).data.money, 2);
  const purchase = await dispatch(runtime, 'p1', 'economy.buy', { itemId: 'food' });
  assert.equal(purchase.data.money, 1);
  assert.equal(purchase.data.inventory.food, 1);
});

test('invalid movement does not mutate authoritative state', async () => {
  const { runtime, store } = createDevelopmentGame({ now: () => 1000 });
  await dispatch(runtime, 'b', 'character.birth', { name: '旅人' });
  const before = store.snapshot();
  const bad = await dispatch(runtime, 'bad', 'location.travel', { destinationId: 'nowhere' });
  assert.equal(bad.code, 'ROUTE_NOT_AVAILABLE');
  assert.deepEqual(store.snapshot(), before);
});

test('unauthenticated actions are rejected', async () => {
  const { runtime } = createDevelopmentGame();
  const result = await runtime.dispatch({ actor: {}, requestId: 'r', action: { type: 'character.birth', payload: { name: 'x' } } });
  assert.equal(result.code, 'UNAUTHENTICATED');
});

test('disabled module actions are unavailable without breaking core', async () => {
  const { runtime } = createDevelopmentGame({ enabledModules: ['character', 'inventory', 'location'] });
  await dispatch(runtime, 'b', 'character.birth', { name: '旅人' });
  assert.equal((await dispatch(runtime, 'x', 'economy.work')).code, 'UNKNOWN_ACTION');
  assert.equal((await dispatch(runtime, 'o', 'location.observe')).ok, true);
});

test('lazy elapsed resolution advances survival without background work', async () => {
  let now = 0;
  const { runtime, store } = createDevelopmentGame({ now: () => now });
  await dispatch(runtime, 'b', 'character.birth', { name: '旅人' });
  now = 60 * 60 * 1000;
  await dispatch(runtime, 'o', 'location.observe');
  const needs = store.snapshot().characters.s1.needs;
  assert.equal(needs.hunger, 2);
  assert.equal(needs.thirst, 3);
  assert.equal(needs.fatigue, 1);
});

test('frequent requests cannot freeze survival progression by discarding fractional elapsed time', async () => {
  let now = 0;
  const { runtime, store } = createDevelopmentGame({ now: () => now });
  await dispatch(runtime, 'fb', 'character.birth', { name: '頻繁旅人' });
  for (let i = 1; i <= 6; i += 1) {
    now = i * 10 * 60 * 1000;
    await dispatch(runtime, `fo-${i}`, 'location.observe');
  }
  const character = store.snapshot().characters.s1;
  assert.equal(character.needs.hunger, 2);
  assert.equal(character.needs.thirst, 3);
  assert.equal(character.needs.fatigue, 1);
  assert.deepEqual(character.needProgressSeconds, { hunger: 0, thirst: 0, fatigue: 0 });
});

test('idempotency ledger is bounded', async () => {
  const { runtime, store } = createDevelopmentGame({ now: () => 0 });
  await dispatch(runtime, 'birth', 'character.birth', { name: '旅人' });
  for (let i = 0; i < MAX_REQUEST_RESULTS + 10; i += 1) {
    await dispatch(runtime, `observe-${i}`, 'location.observe');
  }
  const snapshot = store.snapshot();
  assert.equal(snapshot.requestOrder.length, MAX_REQUEST_RESULTS);
  assert.equal(Object.keys(snapshot.requestResults).length, MAX_REQUEST_RESULTS);
});

test('money source and sink leave bounded game event evidence', async () => {
  const { runtime, store } = createDevelopmentGame({ now: () => 0 });
  await dispatch(runtime, 'b', 'character.birth', { name: '旅人' });
  await dispatch(runtime, 'w', 'economy.work');
  await dispatch(runtime, 'p', 'economy.buy', { itemId: 'food' });
  const types = store.snapshot().gameEvents.map((event) => event.type);
  assert.ok(types.includes('economy.money-created'));
  assert.ok(types.includes('economy.money-sunk'));
});

test('deterministic narrative fallback presents 2 to 4 valid choices', async () => {
  const { runtime } = createDevelopmentGame({ now: () => 1000 });
  await dispatch(runtime, 'nb', 'character.birth', { name: '敘事旅人' });
  const scene = await dispatch(runtime, 'ns', 'narrative.scene');
  assert.equal(scene.ok, true);
  assert.equal(scene.data.narrative.mode, 'deterministic-fallback');
  assert.ok(scene.data.narrative.options.length >= 2);
  assert.ok(scene.data.narrative.options.length <= 4);
  for (const choice of scene.data.narrative.options) {
    assert.equal(typeof choice.label, 'string');
    assert.equal(typeof choice.intent.type, 'string');
  }
});

test('narrative does not offer intents from disabled gameplay modules', async () => {
  const { runtime } = createDevelopmentGame({
    now: () => 1000,
    enabledModules: ['character', 'inventory', 'location', 'narrative'],
  });
  await dispatch(runtime, 'db', 'character.birth', { name: '降級旅人' });
  const scene = await dispatch(runtime, 'ds', 'narrative.scene');
  assert.equal(scene.ok, true);
  assert.deepEqual(
    scene.data.narrative.options.map((choice) => choice.intent.type),
    ['location.travel', 'location.travel'],
  );
});
