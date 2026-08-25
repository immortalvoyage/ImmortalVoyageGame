import test from 'node:test';
import assert from 'node:assert/strict';
import { formatActionResult } from '../public/result-message.js';

test('transport uncertainty tells player to repeat the same action for confirmation', () => {
  assert.match(formatActionResult({ ok: false, code: 'NETWORK_UNAVAILABLE' }, '工作'), /相同的動作/);
  assert.match(formatActionResult({ ok: false, code: 'INTERNAL_ERROR' }, '工作'), /相同的動作/);
  assert.match(formatActionResult({ ok: false, code: 'INVALID_SERVER_RESPONSE' }, '工作'), /相同的動作/);
});

test('a different action is blocked until the uncertain request is reconciled', () => {
  const message = formatActionResult({ ok: false, code: 'ACTION_CONFIRMATION_REQUIRED' }, '移動');
  assert.match(message, /上一個動作/);
  assert.match(message, /相同的動作/);
});
