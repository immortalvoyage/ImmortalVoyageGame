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

test('crafting success and failures produce deterministic feedback', () => {
  assert.equal(
    formatActionResult({ ok: true, code: 'CRAFT_COMPLETED', data: { crafted: { name: '簡單餐食', quantity: 1 } } }, '製作'),
    '已製作簡單餐食 × 1。',
  );
  assert.equal(formatActionResult({ ok: false, code: 'CRAFT_MATERIALS_MISSING' }, '製作'), '製作材料不足。');
  assert.equal(formatActionResult({ ok: false, code: 'CRAFT_NOT_AVAILABLE' }, '製作'), '這裡目前無法進行這項製作。');
});

test('trade success and failures produce deterministic feedback without raw codes', () => {
  assert.equal(
    formatActionResult({ ok: true, code: 'TRADE_LISTED', data: {} }, '上架'),
    '寄售已上架，物品已進入交易保管。',
  );
  assert.equal(
    formatActionResult({
      ok: true,
      code: 'TRADE_PURCHASED',
      data: { purchased: { name: '食物', quantity: 2, totalPrice: 3 } },
    }, '購買'),
    '已用 3 貨幣購買食物 × 2。',
  );
  assert.equal(
    formatActionResult({ ok: true, code: 'TRADE_CANCELLED', data: { returned: { name: '水', quantity: 1 } } }, '取消'),
    '已取消寄售，取回水 × 1。',
  );
  assert.equal(formatActionResult({ ok: false, code: 'TRADE_NOT_OWNER' }, '取消'), '你不能取消別人的寄售。');
  assert.equal(formatActionResult({ ok: false, code: 'TRADE_INVENTORY_LIMIT' }, '購買'), '物品數量已達目前可安全保存的上限。');
});

test('known action failures are translated without exposing raw codes', () => {
  assert.equal(formatActionResult({ ok: false, code: 'INSUFFICIENT_FUNDS' }, '購買食物'), '金錢不足。');
  assert.equal(formatActionResult({ ok: false, code: 'PURPOSE_TARGET_UNKNOWN' }, '尋找某人'), '你目前沒有足夠情報尋找這個目標。');
  assert.equal(formatActionResult({ ok: false, code: 'INVALID_NAME' }, '出生'), '請輸入 1～24 個字的角色姓名。');
});

test('unknown or incomplete results use safe fallback without exposing raw internals', () => {
  assert.equal(formatActionResult({ ok: true, code: 'SOMETHING_NEW', data: { secret: 'x' } }, '測試行動'), '測試行動：完成');
  assert.equal(formatActionResult({ ok: true, code: 'NPC_INTERACTION', data: {} }, '交談'), '交談：完成');
  const failed = formatActionResult({ ok: false, code: 'SERVER_INTERNAL_SECRET_CODE', data: { secret: 'x' } }, '測試行動');
  assert.equal(failed, '測試行動：無法完成。');
  assert.equal(failed.includes('SERVER_INTERNAL_SECRET_CODE'), false);
});
