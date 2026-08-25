import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryGameStore } from '../src/adapters/memory-game-store.js';
import { GameRuntime } from '../src/core/game-runtime.js';
import { createInitialWorld } from '../src/core/world-state.js';

const actor = { sessionId: 'elapsed-context-session' };

test('elapsed resolvers receive the same server-owned runtime context as action handlers', async () => {
  const observed = [];
  const probeModule = {
    manifest: { name: 'elapsed-probe', actions: ['elapsed-probe.observe'] },
    resolveElapsed({ elapsedSeconds, context }) {
      observed.push({
        elapsedSeconds,
        marker: context.marker,
        actionAvailable: context.isActionAvailable('elapsed-probe.observe'),
        nowMs: context.nowMs,
      });
    },
    actions: {
      'elapsed-probe.observe': ({ context }) => ({
        ok: true,
        code: 'ELAPSED_PROBE_OBSERVED',
        data: { marker: context.marker },
      }),
    },
  };

  const store = new MemoryGameStore(createInitialWorld({ nowMs: 1000 }));
  const runtime = new GameRuntime({
    store,
    modules: [probeModule],
    runtimeContext: { marker: 'server-owned' },
    now: () => 6000,
  });

  const result = await runtime.dispatch({
    actor,
    requestId: 'elapsed-context',
    action: { type: 'elapsed-probe.observe', payload: {} },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.data, { marker: 'server-owned' });
  assert.deepEqual(observed, [{
    elapsedSeconds: 5,
    marker: 'server-owned',
    actionAvailable: true,
    nowMs: 6000,
  }]);
});
