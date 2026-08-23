import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFileBackedDevelopmentGame } from '../src/game.js';
import { CURRENT_SCHEMA_VERSION } from '../src/core/world-state.js';

const actor = { sessionId: 'persist-session' };

async function dispatch(runtime, requestId, type, payload) {
  return runtime.dispatch({ actor, requestId, action: { type, payload } });
}

test('file store survives runtime restart without external database', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'iv-store-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const filePath = join(dir, 'world.json');

  const first = createFileBackedDevelopmentGame({ filePath, now: () => 1000 });
  await dispatch(first.runtime, 'birth', 'character.birth', { name: '留存旅人' });
  await dispatch(first.runtime, 'work', 'economy.work', { jobId: 'starter-labor' });

  const second = createFileBackedDevelopmentGame({ filePath, now: () => 2000 });
  const observed = await dispatch(second.runtime, 'observe', 'location.observe');
  assert.equal(observed.data.character.name, '留存旅人');
  assert.equal(observed.data.character.money, 2);
  assert.equal(observed.data.character.ownerSessionId, undefined);

  const stored = JSON.parse(await readFile(filePath, 'utf8'));
  assert.equal(stored.characters['persist-session'].money, 2);
});

test('legacy schema v1 save migrates on the next successful authoritative action', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'iv-store-migrate-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const filePath = join(dir, 'world.json');
  const legacy = {
    schemaVersion: 1,
    worldId: 'legacy-v1',
    logicalTimeSeconds: 0,
    lastResolvedAtMs: 1000,
    characters: {
      'persist-session': {
        id: 'char:7',
        ownerSessionId: 'persist-session',
        name: '舊存檔旅人',
        status: 'alive',
        locationId: 'starter-square',
        needs: { hunger: 1, thirst: 2, fatigue: 3 },
        inventory: {},
        money: 0,
      },
    },
    requestResults: {},
    requestOrder: [],
    gameEvents: [],
  };
  await writeFile(filePath, `${JSON.stringify(legacy, null, 2)}\n`, 'utf8');

  const game = createFileBackedDevelopmentGame({ filePath, now: () => 1000 });
  const observed = await dispatch(game.runtime, 'migrate-observe', 'location.observe');
  assert.equal(observed.ok, true);
  assert.equal(observed.data.character.name, '舊存檔旅人');

  const stored = JSON.parse(await readFile(filePath, 'utf8'));
  assert.equal(stored.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(stored.nextCharacterSequence, 8);
  assert.deepEqual(stored.characters['persist-session'].needProgressSeconds, { hunger: 0, thirst: 0, fatigue: 0 });
});

test('corrupted save fails closed instead of silently resetting world', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'iv-store-corrupt-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const filePath = join(dir, 'world.json');
  await writeFile(filePath, '{not-json', 'utf8');

  const game = createFileBackedDevelopmentGame({ filePath });
  await assert.rejects(
    () => dispatch(game.runtime, 'observe', 'location.observe'),
    SyntaxError,
  );
  assert.equal(await readFile(filePath, 'utf8'), '{not-json');
});
