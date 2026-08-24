import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { createDevelopmentGame } from '../src/game.js';
import { devStarterPack } from '../src/content/dev-starter.js';

const actor = { sessionId: 'content-injection-session' };

async function dispatch(runtime, requestId, type, payload = {}) {
  return runtime.dispatch({ actor, requestId, action: { type, payload } });
}

function makeInjectedPack() {
  const pack = structuredClone(devStarterPack);
  pack.id = 'test-injected-pack';

  const injectedSquare = pack.locations['starter-square'];
  delete pack.locations['starter-square'];
  pack.locations['injected-square'] = injectedSquare;
  pack.startingLocationId = 'injected-square';
  pack.locations['starter-well'].routes = ['injected-square'];
  pack.locations['starter-grove'].routes = ['injected-square'];
  pack.npcs.foreman.locationId = 'injected-square';

  injectedSquare.name = '注入測試廣場';
  injectedSquare.description = '這段描述只存在於注入測試內容。';
  injectedSquare.jobs[0].rewardMoney = 7;
  pack.locations['starter-well'].gatherables[0].quantity = 2;
  pack.npcs.foreman.name = '注入測試領班';
  pack.npcs.foreman.greeting = '這是由注入 Content Pack 提供的招呼。';
  pack.items.food.name = '注入測試食物';
  pack.items['simple-meal'].name = '注入測試餐食';
  pack.careers['starter-labor-hand'].name = '注入測試熟手';
  return pack;
}

test('validated injected Content Pack drives gameplay and public narrative data', async () => {
  const contentPack = makeInjectedPack();
  const { runtime } = createDevelopmentGame({ contentPack, now: () => 1000 });

  const born = await dispatch(runtime, 'birth', 'character.birth', { name: '注入旅人' });
  assert.equal(born.data.character.locationId, 'injected-square');

  let scene = await dispatch(runtime, 'scene-0', 'narrative.scene');
  assert.equal(scene.data.location.id, 'injected-square');
  assert.equal(scene.data.location.name, '注入測試廣場');
  assert.equal(scene.data.narrative.text, '這段描述只存在於注入測試內容。');
  assert.ok(scene.data.visibleNpcs.some((npc) => npc.name === '注入測試領班'));
  assert.ok(scene.data.utilities.some((entry) => entry.label.includes('注入測試食物')));

  const interaction = await dispatch(runtime, 'npc', 'npc.interact', { npcId: 'foreman' });
  assert.equal(interaction.data.text, '這是由注入 Content Pack 提供的招呼。');

  for (let i = 1; i <= 3; i += 1) {
    const work = await dispatch(runtime, `work-${i}`, 'economy.work', { jobId: 'starter-labor' });
    assert.equal(work.data.money, i * 7);
  }
  scene = await dispatch(runtime, 'scene-3', 'narrative.scene');
  assert.deepEqual(scene.data.careers, [{ name: '注入測試熟手' }]);

  await dispatch(runtime, 'to-well', 'location.travel', { destinationId: 'starter-well' });
  const gatheredWater = await dispatch(runtime, 'gather-water', 'survival.gather', { itemId: 'water' });
  assert.equal(gatheredWater.data.inventory.water, 2);

  const found = await dispatch(runtime, 'find-foreman', 'purpose.find-npc', { npcId: 'foreman' });
  assert.equal(found.code, 'PURPOSE_TARGET_FOUND');
  assert.equal(found.data.location.id, 'injected-square');

  await dispatch(runtime, 'to-grove', 'location.travel', { destinationId: 'starter-grove' });
  await dispatch(runtime, 'gather-food', 'survival.gather', { itemId: 'food' });
  await dispatch(runtime, 'back-square', 'location.travel', { destinationId: 'injected-square' });
  const crafted = await dispatch(runtime, 'craft', 'crafting.craft', { recipeId: 'starter-simple-meal' });
  assert.deepEqual(crafted.data.crafted, { name: '注入測試餐食', quantity: 1 });
});

test('invalid injected Content Pack fails closed at the game wiring boundary', () => {
  const contentPack = makeInjectedPack();
  contentPack.startingLocationId = 'missing-start';
  assert.throws(
    () => createDevelopmentGame({ contentPack, now: () => 1000 }),
    /starting location does not exist/,
  );
});

test('gameplay modules do not directly import the development Content Pack', async () => {
  const modulesDirectory = new URL('../src/modules/', import.meta.url);
  const entries = await readdir(modulesDirectory, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const source = await readFile(new URL(`../src/modules/${entry.name}/index.js`, import.meta.url), 'utf8');
    assert.equal(source.includes('devStarterPack'), false, `${entry.name} must use injected content`);
    assert.equal(source.includes("../../content/dev-starter.js"), false, `${entry.name} must not import dev starter content`);
  }
});
