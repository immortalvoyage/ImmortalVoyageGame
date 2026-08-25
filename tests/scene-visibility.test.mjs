import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowNarrativeText, shouldShowUtilityPanel } from '../public/scene-visibility.js';

test('duplicate or empty narrative text stays hidden beside the same location description', () => {
  assert.equal(shouldShowNarrativeText('同一段描述', '同一段描述'), false);
  assert.equal(shouldShowNarrativeText('同一段描述', '  同一段描述  '), false);
  assert.equal(shouldShowNarrativeText('地點描述', ''), false);
  assert.equal(shouldShowNarrativeText('地點描述', '新的情境變化'), true);
});

test('secondary utility surface appears only when actionable utilities exist', () => {
  assert.equal(shouldShowUtilityPanel(undefined), false);
  assert.equal(shouldShowUtilityPanel([]), false);
  assert.equal(shouldShowUtilityPanel([{ label: '喝水' }]), true);
});
