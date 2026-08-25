import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createDevServer } from '../dev/server.mjs';
import { FileGameStore } from '../src/adapters/file-game-store.js';
import { devStarterPack } from '../src/content/dev-starter.js';
import { createInitialWorld } from '../src/core/world-state.js';
import { createGame } from '../src/game.js';

async function seedWorld(filePath) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(createInitialWorld({ nowMs: 1000 }), null, 2)}\n`, 'utf8');
}

test('HTTP retry with same request id recovers an error observed after disk commit without duplicate birth', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'iv-http-recovery-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const filePath = join(dir, 'world.json');
  await seedWorld(filePath);

  let renameCalls = 0;
  const store = new FileGameStore({
    filePath,
    createInitialWorld: () => createInitialWorld({ nowMs: 1000 }),
    fileOps: {
      rename: async (from, to) => {
        renameCalls += 1;
        await rename(from, to);
        if (renameCalls === 1) throw Object.assign(new Error('simulated ambiguous commit'), { code: 'EIO' });
      },
    },
  });
  const { runtime } = createGame({ store, contentPack: devStarterPack, now: () => 1000 });
  const server = createDevServer({ runtime });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;

  const page = await fetch(base + '/');
  const cookie = page.headers.get('set-cookie').split(';')[0];
  const body = JSON.stringify({
    requestId: 'http-birth-once',
    action: { type: 'character.birth', payload: { name: '一次出生者' } },
  });

  const uncertain = await fetch(base + '/api/action', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body,
  });
  assert.equal(uncertain.status, 500);
  assert.deepEqual(await uncertain.json(), { ok: false, code: 'INTERNAL_ERROR' });

  const recovered = await fetch(base + '/api/action', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body,
  });
  assert.equal(recovered.status, 200);
  const result = await recovered.json();
  assert.equal(result.code, 'CHARACTER_BORN');

  const stored = JSON.parse(await readFile(filePath, 'utf8'));
  assert.equal(Object.keys(stored.characters).length, 1);
  assert.equal(stored.nextCharacterSequence, 2);
  assert.equal(stored.requestOrder.filter((id) => id === 'http-birth-once').length, 1);
  assert.equal(stored.gameEvents.filter((event) => event.type === 'character.born').length, 1);
  assert.equal(renameCalls, 1);
});
