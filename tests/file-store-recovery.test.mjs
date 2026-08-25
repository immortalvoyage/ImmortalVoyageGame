import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { FileGameStore } from '../src/adapters/file-game-store.js';
import { devStarterPack } from '../src/content/dev-starter.js';
import { createInitialWorld } from '../src/core/world-state.js';
import { createGame } from '../src/game.js';

const actor = { sessionId: 'failure-recovery-session' };

async function seedWorld(filePath) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(createInitialWorld({ nowMs: 1000 }), null, 2)}\n`, 'utf8');
}

function gameWithStore(filePath, fileOps) {
  const store = new FileGameStore({
    filePath,
    fileOps,
    createInitialWorld: () => createInitialWorld({ nowMs: 1000 }),
  });
  return { store, ...createGame({ store, contentPack: devStarterPack, now: () => 1000 }) };
}

async function birth(runtime, requestId = 'birth-once') {
  return runtime.dispatch({
    actor,
    requestId,
    action: { type: 'character.birth', payload: { name: '故障恢復旅人' } },
  });
}

test('write failure before rename leaves disk unchanged and same request retry commits once', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'iv-recovery-before-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const filePath = join(dir, 'world.json');
  await seedWorld(filePath);

  let renameCalls = 0;
  const fileOps = {
    rename: async (from, to) => {
      renameCalls += 1;
      if (renameCalls === 1) throw Object.assign(new Error('simulated rename failure'), { code: 'EIO' });
      return rename(from, to);
    },
  };
  const { runtime } = gameWithStore(filePath, fileOps);

  await assert.rejects(() => birth(runtime), /simulated rename failure/);
  const unchanged = JSON.parse(await readFile(filePath, 'utf8'));
  assert.deepEqual(unchanged.characters, {});
  assert.deepEqual(unchanged.requestResults, {});

  const retried = await birth(runtime);
  assert.equal(retried.code, 'CHARACTER_BORN');
  const stored = JSON.parse(await readFile(filePath, 'utf8'));
  assert.equal(Object.keys(stored.characters).length, 1);
  assert.equal(stored.requestOrder.filter((id) => id === 'birth-once').length, 1);
  assert.equal(stored.gameEvents.filter((event) => event.type === 'character.born').length, 1);
  assert.equal(renameCalls, 2);
  assert.equal((await readdir(dir)).some((name) => name.endsWith('.tmp')), false);
});

test('error observed after rename reloads committed disk and same request retry does not mutate twice', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'iv-recovery-after-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const filePath = join(dir, 'world.json');
  await seedWorld(filePath);

  let renameCalls = 0;
  const fileOps = {
    rename: async (from, to) => {
      renameCalls += 1;
      await rename(from, to);
      if (renameCalls === 1) throw Object.assign(new Error('ambiguous post-rename failure'), { code: 'EIO' });
    },
  };
  const { runtime } = gameWithStore(filePath, fileOps);

  await assert.rejects(() => birth(runtime), /ambiguous post-rename failure/);
  const alreadyCommitted = JSON.parse(await readFile(filePath, 'utf8'));
  assert.equal(Object.keys(alreadyCommitted.characters).length, 1);
  assert.equal(alreadyCommitted.requestOrder.filter((id) => id === 'birth-once').length, 1);
  assert.equal(alreadyCommitted.gameEvents.filter((event) => event.type === 'character.born').length, 1);

  const retried = await birth(runtime);
  assert.equal(retried.code, 'CHARACTER_BORN');
  const stored = JSON.parse(await readFile(filePath, 'utf8'));
  assert.equal(Object.keys(stored.characters).length, 1);
  assert.equal(stored.nextCharacterSequence, 2);
  assert.equal(stored.requestOrder.filter((id) => id === 'birth-once').length, 1);
  assert.equal(stored.gameEvents.filter((event) => event.type === 'character.born').length, 1);
  assert.equal(renameCalls, 1);
  assert.equal((await readdir(dir)).some((name) => name.endsWith('.tmp')), false);
});
