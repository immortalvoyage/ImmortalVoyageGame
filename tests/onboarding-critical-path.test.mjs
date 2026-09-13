import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createOnboardingDevServer } from '../dev/server.mjs';

async function listen(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

async function close(server) {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

async function postAction(base, cookie, requestId, type, payload = {}) {
  const response = await fetch(base + '/api/action', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ requestId, action: { type, payload } }),
  });
  return { response, body: await response.json() };
}

function sessionIdFrom(cookie) {
  return decodeURIComponent(cookie.slice('iv_session='.length));
}

test('onboarding reaches a persisted formal first-settlement survival and livelihood loop', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'iv-critical-path-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const filePath = join(dir, 'formal-world.json');
  const server = createOnboardingDevServer({ filePath, now: () => 1000 });
  const base = await listen(server);
  t.after(() => close(server));

  const page = await fetch(base + '/');
  assert.equal(page.status, 200);
  const cookie = page.headers.get('set-cookie').split(';')[0];
  const sessionId = sessionIdFrom(cookie);

  let result = await postAction(base, cookie, 'tutorial-avatar', 'character.birth', { name: '閉環教學者' });
  assert.equal(result.response.status, 200);
  result = await postAction(base, cookie, 'leave-tutorial', 'onboarding.leave-tutorial', { confirmDiscard: true });
  assert.equal(result.body.code, 'TUTORIAL_LEFT');
  result = await postAction(base, cookie, 'formal-birth', 'life.formal-birth', {
    name: '閉環旅人',
    birthLocationId: 'first-square',
  });
  assert.equal(result.body.code, 'FORMAL_LIFE_BORN');

  result = await postAction(base, cookie, 'scene', 'narrative.scene');
  assert.equal(result.body.data.location.id, 'first-square');
  assert.ok(result.body.data.narrative.options.some((entry) => entry.intent.type === 'employment.accept'));
  assert.ok(result.body.data.travelOptions.some((entry) => entry.intent.payload.destinationId === 'first-lodging'));

  result = await postAction(base, cookie, 'meet-foreman', 'npc.interact', { npcId: 'first-foreman' });
  assert.equal(result.body.ok, true);
  result = await postAction(base, cookie, 'accept-carrying', 'employment.accept', { jobId: 'first-carrying-work' });
  assert.equal(result.body.code, 'EMPLOYMENT_STARTED');
  result = await postAction(base, cookie, 'work-carrying', 'economy.work', { jobId: 'first-carrying-work' });
  assert.equal(result.body.code, 'WORK_COMPLETED');
  assert.equal(result.body.data.money, 2);

  result = await postAction(base, cookie, 'buy-bread', 'economy.buy', { itemId: 'coarse-bread' });
  assert.equal(result.body.code, 'PURCHASE_COMPLETED');
  result = await postAction(base, cookie, 'eat-bread', 'survival.consume', { itemId: 'coarse-bread' });
  assert.equal(result.body.code, 'ITEM_CONSUMED');
  result = await postAction(base, cookie, 'buy-water', 'economy.buy', { itemId: 'drinking-water' });
  assert.equal(result.body.code, 'PURCHASE_COMPLETED');
  result = await postAction(base, cookie, 'drink-water', 'survival.consume', { itemId: 'drinking-water' });
  assert.equal(result.body.code, 'ITEM_CONSUMED');

  result = await postAction(base, cookie, 'resign-carrying', 'employment.resign');
  assert.equal(result.body.code, 'EMPLOYMENT_ENDED');
  result = await postAction(base, cookie, 'to-lodging', 'location.travel', { destinationId: 'first-lodging' });
  assert.equal(result.body.ok, true);
  result = await postAction(base, cookie, 'meet-keeper', 'npc.interact', { npcId: 'first-lodging-keeper' });
  assert.equal(result.body.ok, true);
  result = await postAction(base, cookie, 'accept-lodging', 'employment.accept', { jobId: 'first-lodging-work' });
  assert.equal(result.body.code, 'EMPLOYMENT_STARTED');
  result = await postAction(base, cookie, 'work-lodging', 'economy.work', { jobId: 'first-lodging-work' });
  assert.equal(result.body.code, 'WORK_COMPLETED');
  const beforeRest = result.body.data.needs.fatigue;
  result = await postAction(base, cookie, 'rest-lodging', 'survival.rest');
  assert.equal(result.body.code, 'REST_COMPLETED');
  assert.ok(result.body.data.needs.fatigue < beforeRest);

  const world = JSON.parse(await readFile(filePath, 'utf8'));
  const character = world.characters[sessionId];
  assert.equal(character.name, '閉環旅人');
  assert.equal(character.locationId, 'first-lodging');
  assert.equal(character.currentEmployment.jobId, 'first-lodging-work');
  assert.equal(character.money, 2);
  assert.equal(character.inventory['coarse-bread'] ?? 0, 0);
  assert.equal(character.inventory['drinking-water'] ?? 0, 0);
});

test('formal livelihood survives server restart and replay does not duplicate rewards', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'iv-critical-restart-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const filePath = join(dir, 'formal-world.json');

  const firstServer = createOnboardingDevServer({ filePath, now: () => 2000 });
  const firstBase = await listen(firstServer);
  const page = await fetch(firstBase + '/');
  const cookie = page.headers.get('set-cookie').split(';')[0];
  const sessionId = sessionIdFrom(cookie);

  await postAction(firstBase, cookie, 'restart-avatar', 'character.birth', { name: '重啟教學者' });
  await postAction(firstBase, cookie, 'restart-leave', 'onboarding.leave-tutorial', { confirmDiscard: true });
  let result = await postAction(firstBase, cookie, 'restart-birth', 'life.formal-birth', {
    name: '重啟正式旅人',
    birthLocationId: 'first-square',
  });
  assert.equal(result.body.code, 'FORMAL_LIFE_BORN');
  await postAction(firstBase, cookie, 'restart-meet', 'npc.interact', { npcId: 'first-foreman' });
  await postAction(firstBase, cookie, 'restart-employment', 'employment.accept', { jobId: 'first-carrying-work' });
  const firstWork = await postAction(firstBase, cookie, 'restart-work', 'economy.work', { jobId: 'first-carrying-work' });
  assert.equal(firstWork.body.code, 'WORK_COMPLETED');
  assert.equal(firstWork.body.data.money, 2);
  result = await postAction(firstBase, cookie, 'restart-buy-bread', 'economy.buy', { itemId: 'coarse-bread' });
  assert.equal(result.body.code, 'PURCHASE_COMPLETED');
  assert.equal(result.body.data.money, 1);
  await close(firstServer);
  const secondServer = createOnboardingDevServer({ filePath, now: () => 2000 });
  const secondBase = await listen(secondServer);
  t.after(() => close(secondServer));

  result = await postAction(secondBase, cookie, 'restart-scene', 'narrative.scene');
  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.location.id, 'first-square');
  assert.equal(result.body.data.character.money, 1);
  assert.equal(result.body.data.character.inventory['coarse-bread'], 1);
  const reloadedWorld = JSON.parse(await readFile(filePath, 'utf8'));
  assert.equal(reloadedWorld.characters[sessionId].currentEmployment.jobId, 'first-carrying-work');

  const replay = await postAction(secondBase, cookie, 'restart-work', 'economy.work', { jobId: 'first-carrying-work' });
  assert.deepEqual(replay.body, firstWork.body);

  result = await postAction(secondBase, cookie, 'restart-eat-bread', 'survival.consume', { itemId: 'coarse-bread' });
  assert.equal(result.body.code, 'ITEM_CONSUMED');
  result = await postAction(secondBase, cookie, 'restart-work-after', 'economy.work', { jobId: 'first-carrying-work' });
  assert.equal(result.body.code, 'WORK_COMPLETED');
  assert.equal(result.body.data.money, 3);

  const world = JSON.parse(await readFile(filePath, 'utf8'));
  assert.equal(Object.keys(world.characters).length, 1);
  assert.equal(world.characters[sessionId].name, '重啟正式旅人');
  assert.equal(world.characters[sessionId].money, 3);
  assert.equal(world.characters[sessionId].currentEmployment.jobId, 'first-carrying-work');
  assert.equal(world.characters[sessionId].inventory['coarse-bread'] ?? 0, 0);
});
