import test from 'node:test';
import assert from 'node:assert/strict';
import { devStarterPack } from '../src/content/dev-starter.js';
import { validateContentPack } from '../src/content/validate-content-pack.js';
import { createDevelopmentGame } from '../src/game.js';
import { isNpcAvailableAt } from '../src/modules/npc/availability.js';

const actor = { sessionId: 'npc-availability-session' };

function availabilityPack() {
  const pack = structuredClone(devStarterPack);
  pack.npcs.foreman.availability = { periodSeconds: 60, startOffsetSeconds: 0, durationSeconds: 10 };
  return pack;
}

async function dispatch(runtime, requestId, type, payload = {}) {
  return runtime.dispatch({ actor, requestId, action: { type, payload } });
}

test('repeating NPC availability is a pure logical-time rule with bounded window semantics', () => {
  const npc = { availability: { periodSeconds: 60, startOffsetSeconds: 5, durationSeconds: 10 } };
  assert.equal(isNpcAvailableAt(npc, 4), false);
  assert.equal(isNpcAvailableAt(npc, 5), true);
  assert.equal(isNpcAvailableAt(npc, 14), true);
  assert.equal(isNpcAvailableAt(npc, 15), false);
  assert.equal(isNpcAvailableAt(npc, 65), true);
  assert.equal(isNpcAvailableAt({}, 999), true);
  assert.equal(isNpcAvailableAt(npc, -1), false);
});
test('Content Pack validates repeating availability and rejects malformed windows', () => {
  const valid = availabilityPack();
  assert.equal(validateContentPack(valid), valid);

  for (const mutate of [
    (pack) => { pack.npcs.foreman.availability.periodSeconds = 0; },
    (pack) => { pack.npcs.foreman.availability.startOffsetSeconds = 60; },
    (pack) => { pack.npcs.foreman.availability.durationSeconds = 0; },
    (pack) => { pack.npcs.foreman.availability = { periodSeconds: 60, startOffsetSeconds: 55, durationSeconds: 10 }; },
  ]) {
    const invalid = availabilityPack();
    mutate(invalid);
    assert.throws(() => validateContentPack(invalid), /availability/);
  }
});

test('request-time logical time consistently gates presence, interaction, employment, purpose, and narrative', async () => {
  let nowMs = 1000;
  const game = createDevelopmentGame({ contentPack: availabilityPack(), now: () => nowMs });
  await dispatch(game.runtime, 'birth', 'character.birth', { name: '守時旅人' });

  let observed = await dispatch(game.runtime, 'observe-open', 'location.observe');
  assert.ok(observed.data.visibleNpcs.some((npc) => npc.id === 'foreman'));

  nowMs += 15_000;
  observed = await dispatch(game.runtime, 'observe-closed', 'location.observe');
  assert.equal(observed.data.visibleNpcs.some((npc) => npc.id === 'foreman'), false);

  const scene = await dispatch(game.runtime, 'scene-closed', 'narrative.scene');
  assert.equal(scene.data.visibleNpcs.some((npc) => npc.id === 'foreman'), false);
  assert.equal(scene.data.narrative.options.some((entry) => entry.intent.type === 'npc.interact' && entry.intent.payload.npcId === 'foreman'), false);
  assert.equal(scene.data.narrative.options.some((entry) => entry.intent.type === 'employment.accept' && entry.intent.payload.jobId === 'starter-labor'), false);
  const beforeFailures = game.store.snapshot();
  assert.deepEqual(await dispatch(game.runtime, 'talk-closed', 'npc.interact', { npcId: 'foreman' }), { ok: false, code: 'NPC_NOT_AVAILABLE' });
  assert.deepEqual(await dispatch(game.runtime, 'accept-closed', 'employment.accept', { jobId: 'starter-labor' }), { ok: false, code: 'EMPLOYMENT_OFFER_NOT_AVAILABLE' });
  assert.deepEqual(await dispatch(game.runtime, 'find-closed', 'purpose.find-npc', { npcId: 'foreman' }), { ok: false, code: 'PURPOSE_TARGET_NOT_PRESENT' });
  assert.deepEqual(game.store.snapshot(), beforeFailures);

  nowMs += 50_000;
  observed = await dispatch(game.runtime, 'observe-reopen', 'location.observe');
  assert.ok(observed.data.visibleNpcs.some((npc) => npc.id === 'foreman'));
  const reopenedScene = await dispatch(game.runtime, 'scene-reopen', 'narrative.scene');
  assert.ok(reopenedScene.data.narrative.options.some((entry) => entry.intent.type === 'employment.accept' && entry.intent.payload.jobId === 'starter-labor'));
  assert.equal((await dispatch(game.runtime, 'talk-reopen', 'npc.interact', { npcId: 'foreman' })).code, 'NPC_INTERACTION');
  assert.equal((await dispatch(game.runtime, 'find-reopen', 'purpose.find-npc', { npcId: 'foreman' })).code, 'PURPOSE_TARGET_FOUND');
});

test('availability is derived from Content Pack plus World Clock rather than persisted mutable NPC state', async () => {
  let nowMs = 1000;
  const game = createDevelopmentGame({ contentPack: availabilityPack(), now: () => nowMs });
  await dispatch(game.runtime, 'birth-derived', 'character.birth', { name: '時序旅人' });
  assert.ok((await dispatch(game.runtime, 'first-derived', 'location.observe')).data.visibleNpcs.some((npc) => npc.id === 'foreman'));

  nowMs += 15_000;
  const closed = await dispatch(game.runtime, 'closed-derived', 'location.observe');
  assert.equal(closed.data.visibleNpcs.some((npc) => npc.id === 'foreman'), false);
  const serializedWorld = JSON.stringify(game.store.snapshot());
  assert.equal(serializedWorld.includes('"availability":'), false);
  assert.equal(serializedWorld.includes('nextNpcAvailability'), false);
});
test('legacy Narrative fallback does not invent locally absent NPC offers when Situation is disabled', async () => {
  let nowMs = 1000;
  const enabledModules = [
    'character', 'inventory', 'location', 'npc', 'purpose', 'survival', 'employment', 'economy',
    'trade', 'crafting', 'progression', 'career', 'relationship', 'knowledge', 'estate', 'narrative',
  ];
  const game = createDevelopmentGame({ contentPack: availabilityPack(), now: () => nowMs, enabledModules });
  await dispatch(game.runtime, 'birth-legacy', 'character.birth', { name: '降級旅人' });
  nowMs += 15_000;
  await dispatch(game.runtime, 'observe-legacy-closed', 'location.observe');

  const scene = await dispatch(game.runtime, 'scene-legacy-closed', 'narrative.scene');
  assert.equal(scene.data.visibleNpcs.some((npc) => npc.id === 'foreman'), false);
  assert.equal(scene.data.narrative.options.some((entry) => entry.intent.type === 'npc.interact' && entry.intent.payload.npcId === 'foreman'), false);
  assert.equal(scene.data.narrative.options.some((entry) => entry.intent.type === 'purpose.find-npc' && entry.intent.payload.npcId === 'foreman'), false);
  assert.equal(scene.data.narrative.options.some((entry) => entry.intent.type === 'employment.accept' && entry.intent.payload.jobId === 'starter-labor'), false);
});