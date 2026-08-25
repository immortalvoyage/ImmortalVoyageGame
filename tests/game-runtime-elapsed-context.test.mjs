import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryGameStore } from '../src/adapters/memory-game-store.js';
import { GameRuntime } from '../src/core/game-runtime.js';
import { createInitialWorld } from '../src/core/world-state.js';

const actor = { sessionId: 'elapsed-context-session' };

test('elapsed resolvers receive actor plus server-owned context and run even when current global gap is zero', async () => {
  const observed = [];
  const probeModule = {
    manifest: { name: 'elapsed-probe', actions: ['elapsed-probe.observe'] },
    resolveElapsed({ actor: elapsedActor, elapsedSeconds, context }) {
      observed.push({
        sessionId: elapsedActor.sessionId,
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

  const first = await runtime.dispatch({
    actor,
    requestId: 'elapsed-context-1',
    action: { type: 'elapsed-probe.observe', payload: {} },
  });
  const second = await runtime.dispatch({
    actor,
    requestId: 'elapsed-context-2',
    action: { type: 'elapsed-probe.observe', payload: {} },
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(first.data, { marker: 'server-owned' });
  assert.deepEqual(observed, [
    {
      sessionId: actor.sessionId,
      elapsedSeconds: 5,
      marker: 'server-owned',
      actionAvailable: true,
      nowMs: 6000,
    },
    {
      sessionId: actor.sessionId,
      elapsedSeconds: 0,
      marker: 'server-owned',
      actionAvailable: true,
      nowMs: 6000,
    },
  ]);
});
