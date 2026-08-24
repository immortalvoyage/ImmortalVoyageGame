import test from 'node:test';
import assert from 'node:assert/strict';
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
