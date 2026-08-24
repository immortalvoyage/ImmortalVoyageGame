import test from 'node:test';
import assert from 'node:assert/strict';
import { formatActionResult } from '../public/result-message.js';

test('NPC topic response displays server-provided public text', () => {
  assert.equal(
    formatActionResult({ ok: true, code: 'NPC_TOPIC_RESPONSE', data: { text: '這是已解鎖的消息。' } }, '詢問'),
    '這是已解鎖的消息。',
  );
});

test('locked NPC topic uses deterministic failure without exposing raw code', () => {
  const message = formatActionResult({ ok: false, code: 'NPC_TOPIC_NOT_AVAILABLE' }, '詢問');
  assert.equal(message, '你目前還無法從這個人那裡問到這件事。');
  assert.equal(message.includes('NPC_TOPIC_NOT_AVAILABLE'), false);
});
