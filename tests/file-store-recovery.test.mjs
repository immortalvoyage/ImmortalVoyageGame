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


test('ambiguous post-rename trade purchase replays from committed disk without double transfer', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'iv-trade-recovery-after-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const filePath = join(dir, 'world.json');
  await seedWorld(filePath);

  let failAfterRename = false;
  const fileOps = {
    rename: async (from, to) => {
      await rename(from, to);
      if (failAfterRename) {
        failAfterRename = false;
        throw Object.assign(new Error('ambiguous trade commit'), { code: 'EIO' });
      }
    },
  };
  const { runtime } = gameWithStore(filePath, fileOps);
  const seller = { sessionId: 'trade-recovery-seller' };
  const buyer = { sessionId: 'trade-recovery-buyer' };
  const dispatch = (actorValue, requestId, type, payload = {}) => runtime.dispatch({
    actor: actorValue,
    requestId,
    action: { type, payload },
  });

  await dispatch(seller, 'trade-seller-birth', 'character.birth', { name: '故障賣家' });
  await dispatch(buyer, 'trade-buyer-birth', 'character.birth', { name: '故障買家' });
  await dispatch(seller, 'trade-seller-grove', 'location.travel', { destinationId: 'starter-grove' });
  await dispatch(seller, 'trade-seller-food', 'survival.gather', { itemId: 'food' });
  await dispatch(seller, 'trade-seller-home', 'location.travel', { destinationId: 'starter-square' });
  const listed = await dispatch(seller, 'trade-list', 'trade.list', {
    itemId: 'food',
    quantity: 1,
    totalPrice: 3,
  });
  const listingId = listed.data.listing.id;
  await dispatch(buyer, 'trade-buyer-employment', 'employment.accept', { jobId: 'starter-labor' });
  await dispatch(buyer, 'trade-buyer-work-1', 'economy.work', { jobId: 'starter-labor' });
  await dispatch(buyer, 'trade-buyer-work-2', 'economy.work', { jobId: 'starter-labor' });

  failAfterRename = true;
  await assert.rejects(
    () => dispatch(buyer, 'trade-buy-ambiguous', 'trade.buy', { listingId }),
    /ambiguous trade commit/,
  );

  const committed = JSON.parse(await readFile(filePath, 'utf8'));
  assert.equal(committed.tradeListings[listingId], undefined);
  assert.equal(committed.characters[seller.sessionId].money, 3);
  assert.equal(committed.characters[buyer.sessionId].money, 1);
  assert.deepEqual(committed.characters[buyer.sessionId].inventory, { food: 1 });
  assert.equal(committed.requestOrder.filter((id) => id === 'trade-buy-ambiguous').length, 1);
  assert.equal(committed.gameEvents.filter((event) => event.type === 'trade.completed').length, 1);
  assert.equal(committed.gameEvents.filter((event) => event.type === 'economy.money-transferred').length, 1);

  const replay = await dispatch(buyer, 'trade-buy-ambiguous', 'trade.buy', { listingId });
  assert.equal(replay.code, 'TRADE_PURCHASED');
  const stored = JSON.parse(await readFile(filePath, 'utf8'));
  assert.deepEqual(stored, committed);
  assert.equal(stored.requestOrder.filter((id) => id === 'trade-buy-ambiguous').length, 1);
  assert.equal(stored.gameEvents.filter((event) => event.type === 'trade.completed').length, 1);
  assert.equal(stored.gameEvents.filter((event) => event.type === 'economy.money-transferred').length, 1);
});
