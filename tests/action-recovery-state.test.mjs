import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PENDING_ACTION_STORAGE_KEY,
  forgetPendingAction,
  readPendingAction,
  rememberPendingAction,
} from '../public/action-recovery-state.js';

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    values,
  };
}

test('uncertain action survives reload with exact request id and action', () => {
  const store = storage();
  const remembered = rememberPendingAction(store, {
    requestId: 'pending-request',
    action: { type: 'economy.work', payload: { jobId: 'job:1' } },
  });
  assert.equal(remembered.requestId, 'pending-request');

  const restored = readPendingAction(store);
  assert.equal(restored.requestId, 'pending-request');
  assert.deepEqual(restored.action, { type: 'economy.work', payload: { jobId: 'job:1' } });
  assert.equal(restored.key, JSON.stringify(restored.action));
});

test('confirmed action removes reload recovery state', () => {
  const store = storage();
  rememberPendingAction(store, { requestId: 'done', action: { type: 'location.travel', payload: { destinationId: 'next' } } });
  forgetPendingAction(store);
  assert.equal(store.values.has(PENDING_ACTION_STORAGE_KEY), false);
  assert.equal(readPendingAction(store), null);
});

test('malformed persisted data is discarded instead of becoming an action', () => {
  const store = storage();
  store.setItem(PENDING_ACTION_STORAGE_KEY, JSON.stringify({ requestId: '', action: { type: 'economy.work' } }));
  assert.equal(readPendingAction(store), null);
  assert.equal(store.values.has(PENDING_ACTION_STORAGE_KEY), false);
});

test('unavailable browser storage degrades to in-memory normalized state', () => {
  const unavailable = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
    removeItem: () => { throw new Error('blocked'); },
  };
  const pending = rememberPendingAction(unavailable, { requestId: 'memory-only', action: { type: 'survival.rest', payload: {} } });
  assert.equal(pending.requestId, 'memory-only');
  assert.equal(readPendingAction(unavailable), null);
  assert.doesNotThrow(() => forgetPendingAction(unavailable));
});
