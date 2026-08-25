import test from 'node:test';
import assert from 'node:assert/strict';
import { postActionWithRecovery } from '../public/action-client.js';

function jsonResponse(status, value) {
  return { status, json: async () => structuredClone(value) };
}

function invalidJsonResponse(status) {
  return { status, json: async () => { throw new SyntaxError('invalid json'); } };
}

test('transport retry reuses the exact same request body and request id', async () => {
  const calls = [];
  const fetchImpl = async (_url, options) => {
    calls.push(options.body);
    if (calls.length === 1) throw new Error('connection reset');
    return jsonResponse(200, { ok: true, code: 'WORK_COMPLETED', data: { money: 2 } });
  };

  const outcome = await postActionWithRecovery({
    fetchImpl,
    requestId: 'same-request',
    action: { type: 'economy.work', payload: { jobId: 'job:1' } },
  });

  assert.equal(outcome.confirmed, true);
  assert.equal(outcome.result.code, 'WORK_COMPLETED');
  assert.equal(calls.length, 2);
  assert.equal(calls[0], calls[1]);
  assert.equal(JSON.parse(calls[0]).requestId, 'same-request');
});

test('server 5xx is retried with the same request id because commit status may be ambiguous', async () => {
  const calls = [];
  const responses = [
    jsonResponse(500, { ok: false, code: 'INTERNAL_ERROR' }),
    jsonResponse(200, { ok: true, code: 'PURCHASE_COMPLETED', data: { money: 0 } }),
  ];
  const fetchImpl = async (_url, options) => {
    calls.push(options.body);
    return responses.shift();
  };

  const outcome = await postActionWithRecovery({
    fetchImpl,
    requestId: 'purchase-once',
    action: { type: 'economy.buy', payload: { itemId: 'food' } },
  });

  assert.equal(outcome.confirmed, true);
  assert.equal(outcome.result.code, 'PURCHASE_COMPLETED');
  assert.equal(calls.length, 2);
  assert.equal(calls[0], calls[1]);
});

test('malformed 2xx response is retried because the world may already have committed', async () => {
  const calls = [];
  const responses = [
    invalidJsonResponse(200),
    jsonResponse(200, { ok: true, code: 'RESOURCE_GATHERED', data: {} }),
  ];
  const fetchImpl = async (_url, options) => {
    calls.push(options.body);
    return responses.shift();
  };

  const outcome = await postActionWithRecovery({
    fetchImpl,
    requestId: 'malformed-success',
    action: { type: 'survival.gather', payload: { itemId: 'water' } },
  });

  assert.equal(outcome.confirmed, true);
  assert.equal(outcome.result.code, 'RESOURCE_GATHERED');
  assert.equal(calls.length, 2);
  assert.equal(calls[0], calls[1]);
});

test('valid JSON with an invalid 2xx result shape is also retried as ambiguous', async () => {
  const calls = [];
  const responses = [
    jsonResponse(200, { code: 'WORK_COMPLETED' }),
    jsonResponse(200, { ok: true, code: 'WORK_COMPLETED', data: {} }),
  ];
  const fetchImpl = async (_url, options) => {
    calls.push(options.body);
    return responses.shift();
  };

  const outcome = await postActionWithRecovery({
    fetchImpl,
    requestId: 'invalid-shape-success',
    action: { type: 'economy.work', payload: { jobId: 'job:1' } },
  });

  assert.equal(outcome.confirmed, true);
  assert.equal(outcome.result.code, 'WORK_COMPLETED');
  assert.equal(calls.length, 2);
  assert.equal(calls[0], calls[1]);
});

test('repeated malformed 2xx response remains unconfirmed', async () => {
  let calls = 0;
  const outcome = await postActionWithRecovery({
    fetchImpl: async () => {
      calls += 1;
      return invalidJsonResponse(200);
    },
    requestId: 'malformed-uncertain',
    action: { type: 'economy.work', payload: { jobId: 'job:1' } },
  });

  assert.equal(outcome.confirmed, false);
  assert.deepEqual(outcome.result, { ok: false, code: 'INVALID_SERVER_RESPONSE' });
  assert.equal(calls, 2);
});

test('definitive 4xx rejection is not retried', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return jsonResponse(400, { ok: false, code: 'INSUFFICIENT_FUNDS' });
  };

  const outcome = await postActionWithRecovery({
    fetchImpl,
    requestId: 'definitive-failure',
    action: { type: 'economy.buy', payload: { itemId: 'food' } },
  });

  assert.equal(outcome.confirmed, true);
  assert.equal(outcome.result.code, 'INSUFFICIENT_FUNDS');
  assert.equal(calls, 1);
});

test('bounded transport failure remains explicitly unconfirmed after two attempts', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    throw new Error('offline');
  };

  const outcome = await postActionWithRecovery({
    fetchImpl,
    requestId: 'still-uncertain',
    action: { type: 'survival.gather', payload: { itemId: 'water' } },
  });

  assert.equal(outcome.confirmed, false);
  assert.deepEqual(outcome.result, { ok: false, code: 'NETWORK_UNAVAILABLE' });
  assert.equal(calls, 2);
});

test('retry attempts are hard bounded', async () => {
  await assert.rejects(
    () => postActionWithRecovery({
      fetchImpl: async () => jsonResponse(200, { ok: true, code: 'OK' }),
      requestId: 'too-many',
      action: { type: 'location.observe' },
      attempts: 4,
    }),
    /attempts must be an integer between 1 and 3/,
  );
});
