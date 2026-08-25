import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTutorialDevServer } from '../dev/server.mjs';

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

test('tutorial shell is explicit about temporary pre-birth state without changing formal entry copy', async () => {
  const tutorial = await readFile(new URL('../public/tutorial.html', import.meta.url), 'utf8');
  const formal = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

  assert.match(tutorial, /data-mode="tutorial"/);
  assert.match(tutorial, /正式出生前的教學沙盒/);
  assert.match(tutorial, /建立教學 Avatar/);
  assert.match(tutorial, /開始教學/);
  assert.doesNotMatch(tutorial, /<h2>出生<\/h2>/);
  assert.doesNotMatch(tutorial, />進入世界<\/button>/);

  assert.match(formal, /<h2>出生<\/h2>/);
  assert.match(formal, />進入世界<\/button>/);
  assert.doesNotMatch(formal, /data-mode="tutorial"/);
  assert.equal(pkg.scripts['dev:tutorial'], 'node dev/server.mjs --tutorial');
});

test('tutorial dev server serves only the tutorial shell and isolated tutorial gameplay', async (t) => {
  const server = createTutorialDevServer();
  const base = await listen(server);
  t.after(() => close(server));

  const page = await fetch(base + '/');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /default-src 'self'/);
  const html = await page.text();
  assert.match(html, /新手村教學/);
  assert.match(html, /正式出生前的教學沙盒/);
  const cookie = page.headers.get('set-cookie').split(';')[0];

  const forbiddenLife = await postAction(base, cookie, 'pending-forbidden', 'life.create-pending');
  assert.equal(forbiddenLife.response.status, 400);
  assert.equal(forbiddenLife.body.code, 'UNKNOWN_ACTION');

  const born = await postAction(base, cookie, 'tutorial-avatar', 'character.birth', { name: '教學測試者' });
  assert.equal(born.response.status, 200);
  const scene = await postAction(base, cookie, 'tutorial-scene', 'narrative.scene');
  assert.equal(scene.response.status, 200);
  assert.equal(scene.body.data.location.name, '新手村廣場');
  assert.equal(scene.body.data.narrative.mode, 'deterministic-fallback');
  assert.equal(JSON.stringify(scene.body.data).includes('命盤'), false);
});

test('tutorial dev server restart discards browser tutorial state even with the same cookie', async (t) => {
  const firstServer = createTutorialDevServer();
  const firstBase = await listen(firstServer);
  const page = await fetch(firstBase + '/');
  const cookie = page.headers.get('set-cookie').split(';')[0];
  const born = await postAction(firstBase, cookie, 'restart-avatar', 'character.birth', { name: '可丟棄教學者' });
  assert.equal(born.response.status, 200);
  await close(firstServer);

  const secondServer = createTutorialDevServer();
  const secondBase = await listen(secondServer);
  t.after(() => close(secondServer));
  const scene = await postAction(secondBase, cookie, 'restart-scene', 'narrative.scene');
  assert.equal(scene.response.status, 400);
  assert.equal(scene.body.code, 'NO_ACTIVE_CHARACTER');
});
