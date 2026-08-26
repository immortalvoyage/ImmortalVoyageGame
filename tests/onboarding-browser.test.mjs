import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createOnboardingDevServer } from '../dev/server.mjs';
import { formatActionResult } from '../public/result-message.js';

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

function cookieSessionId(cookie) {
  return decodeURIComponent(cookie.slice('iv_session='.length));
}

test('onboarding shell exposes explicit tutorial discard and formal birth controls', async () => {
  const html = await readFile(new URL('../public/onboarding.html', import.meta.url), 'utf8');
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(html, /data-mode="onboarding"/);
  assert.match(html, /離開新手村/);
  assert.match(html, /教學 Avatar 的物品、金錢、關係與進度會全部丟棄/);
  assert.match(html, /正式出生/);
  assert.match(html, /birth-location/);
  assert.equal(pkg.scripts['dev:onboarding'], 'node dev/server.mjs --onboarding');
});
test('tutorial exit discards sandbox resources and formal birth consumes the same Pending Life exactly once', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'iv-onboarding-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const filePath = join(dir, 'formal-world.json');
  const server = createOnboardingDevServer({ filePath, now: () => 1000 });
  const base = await listen(server);
  t.after(() => close(server));

  const page = await fetch(base + '/');
  assert.equal(page.status, 200);
  const cookie = page.headers.get('set-cookie').split(';')[0];
  const sessionId = cookieSessionId(cookie);
  const accountId = `local-onboarding:${sessionId}`;

  let result = await postAction(base, cookie, 'leave-before-avatar', 'onboarding.leave-tutorial', { confirmDiscard: true });
  assert.equal(result.response.status, 400);
  assert.equal(result.body.code, 'TUTORIAL_AVATAR_REQUIRED');

  result = await postAction(base, cookie, 'avatar', 'character.birth', { name: '教學旅人' });
  assert.equal(result.response.status, 200);
  result = await postAction(base, cookie, 'to-well', 'location.travel', { destinationId: 'tutorial-well' });
  assert.equal(result.response.status, 200);
  result = await postAction(base, cookie, 'water', 'survival.gather', { itemId: 'tutorial-water' });
  assert.equal(result.response.status, 200);
  result = await postAction(base, cookie, 'leave-no-confirm', 'onboarding.leave-tutorial', {});
  assert.equal(result.response.status, 400);
  assert.equal(result.body.code, 'TUTORIAL_EXIT_CONFIRMATION_REQUIRED');

  result = await postAction(base, cookie, 'leave-confirmed', 'onboarding.leave-tutorial', { confirmDiscard: true });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.code, 'TUTORIAL_LEFT');
  const pendingInstant = structuredClone(result.body.data.pendingLife.birthWorldInstant);

  let world = JSON.parse(await readFile(filePath, 'utf8'));
  assert.deepEqual(world.characters, {});
  assert.deepEqual(world.pendingLives[accountId].birthWorldInstant, pendingInstant);
  assert.equal(JSON.stringify(world).includes('tutorial-water'), false);
  assert.equal(JSON.stringify(world).includes('教學旅人'), false);

  result = await postAction(base, cookie, 'direct-birth-blocked', 'character.birth', { name: '偷跑者' });
  assert.equal(result.response.status, 400);
  assert.equal(result.body.code, 'FORMAL_BIRTH_REQUIRED');

  result = await postAction(base, cookie, 'birth-options', 'life.observe-birth-options');
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body.data.options.map(({ id }) => id), ['first-square']);
  result = await postAction(base, cookie, 'forged-location', 'life.formal-birth', {
    name: '正式旅人',
    birthLocationId: 'tutorial-square',
  });
  assert.equal(result.response.status, 400);
  assert.equal(result.body.code, 'BIRTH_LOCATION_NOT_AVAILABLE');

  result = await postAction(base, cookie, 'formal-birth', 'life.formal-birth', {
    name: '正式旅人',
    birthLocationId: 'first-square',
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.code, 'FORMAL_LIFE_BORN');

  const replay = await postAction(base, cookie, 'formal-birth', 'life.formal-birth', {
    name: '正式旅人',
    birthLocationId: 'first-square',
  });
  assert.equal(replay.response.status, 200);
  assert.deepEqual(replay.body, result.body);
  world = JSON.parse(await readFile(filePath, 'utf8'));
  assert.equal(world.pendingLives[accountId], undefined);
  const character = world.characters[sessionId];
  assert.equal(character.ownerAccountId, accountId);
  assert.deepEqual(character.birthWorldInstant, pendingInstant);
  assert.equal(character.locationId, 'first-square');
  assert.deepEqual(character.inventory, {});
  assert.equal(character.money, 0);
  assert.deepEqual(character.behaviorCounts, {});
});
test('server restart resumes authoritative Pending Life instead of reopening tutorial', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'iv-onboarding-restart-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const filePath = join(dir, 'formal-world.json');
  const firstServer = createOnboardingDevServer({ filePath, now: () => 2000 });
  const firstBase = await listen(firstServer);
  const page = await fetch(firstBase + '/');
  const cookie = page.headers.get('set-cookie').split(';')[0];
  await postAction(firstBase, cookie, 'restart-avatar', 'character.birth', { name: '重啟教學者' });
  const left = await postAction(firstBase, cookie, 'restart-leave', 'onboarding.leave-tutorial', { confirmDiscard: true });
  assert.equal(left.response.status, 200);
  const pendingInstant = structuredClone(left.body.data.pendingLife.birthWorldInstant);
  await close(firstServer);
  const secondServer = createOnboardingDevServer({ filePath, now: () => 3000 });
  const secondBase = await listen(secondServer);
  t.after(() => close(secondServer));
  let result = await postAction(secondBase, cookie, 'restart-scene', 'narrative.scene');
  assert.equal(result.response.status, 400);
  assert.equal(result.body.code, 'FORMAL_BIRTH_PENDING');
  result = await postAction(secondBase, cookie, 'restart-options', 'life.observe-birth-options');
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body.data.options.map(({ id }) => id), ['first-square']);
  result = await postAction(secondBase, cookie, 'restart-formal-birth', 'life.formal-birth', {
    name: '重啟正式旅人',
    birthLocationId: 'first-square',
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.code, 'FORMAL_LIFE_BORN');
  const world = JSON.parse(await readFile(filePath, 'utf8'));
  const sessionId = cookieSessionId(cookie);
  const character = world.characters[sessionId];
  assert.deepEqual(character.birthWorldInstant, pendingInstant);
  assert.equal(character.ownerAccountId, `local-onboarding:${sessionId}`);
  assert.equal(world.pendingLives[`local-onboarding:${sessionId}`], undefined);
});

test('onboarding lifecycle failures have deterministic player-safe messages', () => {
  assert.equal(
    formatActionResult({ ok: false, code: 'TUTORIAL_EXIT_CONFIRMATION_REQUIRED' }, '離開新手村'),
    '離開新手村前需要明確確認：教學 Avatar 的物品、金錢、關係與進度都會丟棄。',
  );
  assert.equal(
    formatActionResult({ ok: false, code: 'FORMAL_BIRTH_PENDING' }, '讀取世界'),
    '新手村已結束；請先完成正式出生。',
  );
  assert.equal(
    formatActionResult({ ok: false, code: 'BIRTH_LOCATION_NOT_AVAILABLE' }, '正式出生'),
    '這個出生地目前不可用，請重新選擇。',
  );
});
