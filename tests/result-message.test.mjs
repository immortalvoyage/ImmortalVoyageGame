import test from 'node:test';
import assert from 'node:assert/strict';
import { formatActionResult } from '../public/result-message.js';

test('NPC interaction displays server-provided public dialogue', () => {
  const message = formatActionResult({
    ok: true,
    code: 'NPC_INTERACTION',
    data: { text: '這裡總有些搬運和整理的活計。' },
  }, '與領班交談');
  assert.equal(message, '這裡總有些搬運和整理的活計。');
});

test('purpose progress describes public next step without requiring hidden target location', () => {
  const message = formatActionResult({
    ok: true,
    code: 'PURPOSE_SEARCH_PROGRESS',
    data: {
      location: { id: 'starter-square', name: '開發聚落廣場' },
      target: { id: 'foreman', name: '聚落雜役領班' },
    },
  }, '尋找領班');
  assert.equal(message, '你先前往開發聚落廣場，繼續尋找聚落雜役領班。');
});

test('purpose found and travel results produce useful deterministic feedback', () => {
  assert.equal(
    formatActionResult({ ok: true, code: 'PURPOSE_TARGET_FOUND', data: { npc: { name: '聚落雜役領班' } } }),
    '你找到了聚落雜役領班。',
  );
  assert.equal(
    formatActionResult({ ok: true, code: 'TRAVEL_COMPLETED', data: { location: { name: '公共水井' } } }),
    '已抵達公共水井。',
  );
});

test('unknown or incomplete result falls back without exposing raw internals', () => {
  assert.equal(formatActionResult({ ok: true, code: 'SOMETHING_NEW', data: { secret: 'x' } }, '測試行動'), '測試行動：完成');
  assert.equal(formatActionResult({ ok: true, code: 'NPC_INTERACTION', data: {} }, '交談'), '交談：完成');
});
