import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDevServer } from '../dev/server.mjs';
import { firstSettlementPack } from '../src/content/first-settlement.js';

test('dev server can run the first settlement on a separate file-backed world', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'iv-first-settlement-server-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const server = createDevServer({
    contentPack: firstSettlementPack,
    filePath: join(dir, 'world.json'),
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;

  const page = await fetch(base + '/');
  assert.equal(page.status, 200);
  const cookie = page.headers.get('set-cookie').split(';')[0];

  const born = await fetch(base + '/api/action', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      requestId: 'first-server-birth',
      action: { type: 'character.birth', payload: { name: '正式生活旅人' } },
    }),
  });
  assert.equal(born.status, 200);

  const sceneResponse = await fetch(base + '/api/action', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ requestId: 'first-server-scene', action: { type: 'narrative.scene', payload: {} } }),
  });
  assert.equal(sceneResponse.status, 200);
  const scene = await sceneResponse.json();
  assert.equal(scene.data.location.name, '初始聚落街口');
  assert.ok(scene.data.narrative.options.some((entry) => entry.intent.type === 'employment.accept'));
  assert.equal(JSON.stringify(scene.data).includes('needCosts'), false);
});
