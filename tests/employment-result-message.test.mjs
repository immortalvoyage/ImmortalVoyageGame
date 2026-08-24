import test from 'node:test';
import assert from 'node:assert/strict';
import { formatActionResult } from '../public/result-message.js';

test('employment start and resignation produce deterministic public feedback', () => {
  const started = formatActionResult({
    ok: true,
    code: 'EMPLOYMENT_STARTED',
    data: {
      employment: {
        job: { title: '聚落雜役' },
        employer: { name: '聚落雜役領班' },
      },
    },
  }, '接受工作');
  assert.equal(started, '你已受雇為聚落雜役，雇主是聚落雜役領班。');

  const ended = formatActionResult({
    ok: true,
    code: 'EMPLOYMENT_ENDED',
    data: { employment: { job: { title: '聚落雜役' } } },
  }, '離職');
  assert.equal(ended, '你已離開聚落雜役這份工作。');
});

test('employment contract failures use bounded player-facing messages', () => {
  assert.equal(
    formatActionResult({ ok: false, code: 'EMPLOYMENT_REQUIRED' }, '工作'),
    '這份工作需要先與雇主建立受雇關係。',
  );
  assert.equal(
    formatActionResult({ ok: false, code: 'EMPLOYMENT_ALREADY_ACTIVE' }, '接受工作'),
    '你目前已經有一份現職，必須先離職才能接受另一份工作。',
  );
  assert.equal(
    formatActionResult({ ok: false, code: 'EMPLOYMENT_OFFER_NOT_AVAILABLE' }, '接受工作'),
    '這份工作目前無法受雇。',
  );
  assert.equal(
    formatActionResult({ ok: false, code: 'EMPLOYMENT_NOT_ACTIVE' }, '離職'),
    '你目前沒有可離開的現職。',
  );
});
