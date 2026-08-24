import test from 'node:test';
import assert from 'node:assert/strict';
import { devStarterPack } from '../src/content/dev-starter.js';
import { createDevelopmentGame } from '../src/game.js';
import { MAX_SITUATION_OPPORTUNITIES } from '../src/modules/situation/index.js';

const actor = { sessionId: 'situation-session' };

async function dispatch(runtime, requestId, type, payload = {}) {
  return runtime.dispatch({ actor, requestId, action: { type, payload } });
}

async function bornGame(options = {}) {
  const game = createDevelopmentGame({ now: () => 1000, ...options });
  await dispatch(game.runtime, 'birth', 'character.birth', { name: '日常旅人' });
  return game;
}

async function setCharacter(game, mutator) {
  const world = game.store.snapshot();
  mutator(world.characters[actor.sessionId]);
  await game.store.replace(world);
}

function crowdedPack() {
  const pack = structuredClone(devStarterPack);
  for (let index = 1; index <= 5; index += 1) {
    pack.npcs[`crowd-${index}`] = {
      name: `路人${index}`,
      locationId: 'starter-square',
      greeting: '路過。',
    };
  }
  return pack;
}

function knowledgeTargetPack() {
  const pack = structuredClone(devStarterPack);
  pack.npcs.herbalist = {
    name: '採藥人',
    locationId: 'starter-grove',
    greeting: '林子裡藥草不少。',
    searchLabel: '尋找採藥人',
  };
  pack.knowledge['rumor:herbalist'] = {
    name: '聽說近郊有位採藥人',
    revealsNpcIds: ['herbalist'],
  };
  return pack;
}

test('Situation observe returns at most four server-shaped world opportunities', async () => {
  const game = await bornGame();
  const situation = await dispatch(game.runtime, 'situation', 'situation.observe');

  assert.equal(situation.code, 'SITUATION_PRESENTED');
  assert.ok(situation.data.opportunities.length > 0);
  assert.ok(situation.data.opportunities.length <= MAX_SITUATION_OPPORTUNITIES);
  assert.ok(situation.data.opportunities.some((entry) => entry.intent.type === 'npc.interact'));
  assert.ok(situation.data.opportunities.some((entry) => entry.intent.type === 'economy.work'));
  assert.ok(situation.data.opportunities.some((entry) => entry.intent.type === 'location.travel'));
  assert.equal(situation.data.opportunities.some((entry) => entry.intent.type.startsWith('trade.')), false);
  assert.equal(situation.data.opportunities.some((entry) => entry.intent.type.startsWith('crafting.')), false);
});

test('Narrative uses the same Situation opportunity contract when the module is active', async () => {
  const game = await bornGame();
  const situation = await dispatch(game.runtime, 'situation', 'situation.observe');
  const scene = await dispatch(game.runtime, 'scene', 'narrative.scene');

  assert.deepEqual(scene.data.narrative.options, situation.data.opportunities);
});

test('critical survival pressure keeps recovery travel ahead of optional social content and hides work', async () => {
  const game = await bornGame();
  await setCharacter(game, (character) => {
    character.needs.hunger = 90;
    character.needs.thirst = 90;
  });

  const situation = await dispatch(game.runtime, 'critical-situation', 'situation.observe');
  assert.equal(situation.data.opportunities.some((entry) => entry.intent.type === 'economy.work'), false);

  const destinations = situation.data.opportunities
    .filter((entry) => entry.intent.type === 'location.travel')
    .map((entry) => entry.intent.payload.destinationId);
  assert.deepEqual(destinations.slice(0, 2), ['starter-well', 'starter-grove']);
  assert.ok(situation.data.opportunities.findIndex((entry) => entry.intent.type === 'location.travel')
    < situation.data.opportunities.findIndex((entry) => entry.intent.type === 'npc.interact'));
});

test('crowded locations cannot crowd livelihood and travel out of the bounded opportunity set', async () => {
  const game = await bornGame({ contentPack: crowdedPack() });
  const situation = await dispatch(game.runtime, 'crowded', 'situation.observe');

  assert.equal(situation.data.opportunities.length, MAX_SITUATION_OPPORTUNITIES);
  assert.ok(situation.data.opportunities.some((entry) => entry.intent.type === 'npc.interact'));
  assert.ok(situation.data.opportunities.some((entry) => entry.intent.type === 'economy.work'));
  assert.ok(situation.data.opportunities.some((entry) => entry.intent.type === 'location.travel'));
});

test('knowledge-derived Purpose opportunities require authoritative learned state and do not leak target location', async () => {
  const game = await bornGame({ contentPack: knowledgeTargetPack() });
  const before = await dispatch(game.runtime, 'before-knowledge', 'situation.observe');
  assert.equal(before.data.opportunities.some(
    (entry) => entry.intent.type === 'purpose.find-npc' && entry.intent.payload.npcId === 'herbalist',
  ), false);

  await setCharacter(game, (character) => { character.knowledgeIds.push('rumor:herbalist'); });
  const after = await dispatch(game.runtime, 'after-knowledge', 'situation.observe');
  const target = after.data.opportunities.find(
    (entry) => entry.intent.type === 'purpose.find-npc' && entry.intent.payload.npcId === 'herbalist',
  );

  assert.deepEqual(target, {
    label: '尋找採藥人',
    intent: { type: 'purpose.find-npc', payload: { npcId: 'herbalist' } },
  });
  assert.equal(JSON.stringify(target).includes('starter-grove'), false);
  assert.equal(JSON.stringify(target).includes('knowledgeIds'), false);
  assert.equal(JSON.stringify(target).includes('revealsNpcIds'), false);
});

test('Situation Module off removes direct observation while Narrative keeps the legacy safe fallback', async () => {
  const enabledModules = [
    'character', 'inventory', 'location', 'npc', 'purpose', 'survival', 'economy', 'trade',
    'crafting', 'progression', 'career', 'relationship', 'knowledge', 'estate', 'narrative',
  ];
  const game = await bornGame({ enabledModules });

  const direct = await dispatch(game.runtime, 'no-situation', 'situation.observe');
  assert.equal(direct.code, 'UNKNOWN_ACTION');

  const scene = await dispatch(game.runtime, 'fallback-scene', 'narrative.scene');
  assert.ok(scene.data.narrative.options.some((entry) => entry.intent.type === 'economy.work'));
  assert.ok(scene.data.narrative.options.some((entry) => entry.intent.type === 'location.travel'));
});

test('Situation observation requires an owned active character', async () => {
  const game = createDevelopmentGame({ now: () => 1000 });
  const result = await dispatch(game.runtime, 'no-character', 'situation.observe');
  assert.equal(result.code, 'NO_ACTIVE_CHARACTER');
});
