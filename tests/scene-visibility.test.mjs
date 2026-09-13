import test from 'node:test';
import assert from 'node:assert/strict';
import { narrativeTextForDisplay, shouldShowNarrativeText, shouldShowUtilityPanel } from '../public/scene-visibility.js';

test('duplicate location copy is removed without discarding new narrative state', () => {
  assert.equal(narrativeTextForDisplay('同一段描述', '同一段描述'), '');
  assert.equal(narrativeTextForDisplay('同一段描述', '  同一段描述  '), '');
  assert.equal(narrativeTextForDisplay('地點描述。', '地點描述。 你已明顯感到口渴。'), '你已明顯感到口渴。');
  assert.equal(narrativeTextForDisplay('地點描述', '地點描述不同，不能裁剪'), '地點描述不同，不能裁剪');
  assert.equal(narrativeTextForDisplay('地點描述', '新的情境變化'), '新的情境變化');
  assert.equal(shouldShowNarrativeText('地點描述', ''), false);
  assert.equal(shouldShowNarrativeText('地點描述。', '地點描述。 新的情境變化'), true);
});

test('secondary utility surface appears only when actionable utilities exist', () => {
  assert.equal(shouldShowUtilityPanel(undefined), false);
  assert.equal(shouldShowUtilityPanel([]), false);
  assert.equal(shouldShowUtilityPanel([{ label: '喝水' }]), true);
});
