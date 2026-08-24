import test from 'node:test';
import assert from 'node:assert/strict';
import { formatActionResult } from '../public/result-message.js';

test('rest unavailable uses a deterministic player-safe message', () => {
  assert.equal(
    formatActionResult({ ok: false, code: 'REST_NOT_AVAILABLE', data: { internal: 'do-not-leak' } }, '休息'),
    '這裡不是可以安心休息的場所。',
  );
});
