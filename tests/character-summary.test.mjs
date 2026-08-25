import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCharacterSummaryRows } from '../public/character-summary.js';

function newPlayerView() {
  return {
    character: {
      name: '初來旅人',
      money: 0,
      needs: { hunger: 0, thirst: 0, fatigue: 0 },
    },
    careers: [],
    employment: { current: null },
    progression: { skills: [], socialTags: [] },
    relationships: [],
    knowledge: [],
    inventoryItems: [],
  };
}

test('new players see core state without empty future-system placeholders', () => {
  const rows = buildCharacterSummaryRows(newPlayerView());
  assert.deepEqual(rows, [
    ['姓名', '初來旅人'],
    ['貨幣', '0'],
    ['飢餓', '0'],
    ['口渴', '0'],
    ['疲勞', '0'],
    ['背包', '空'],
  ]);
});

test('formed state appears progressively when the character actually earns it', () => {
  const view = newPlayerView();
  view.careers = [{ name: '聚落短工熟手' }];
  view.employment.current = {
    job: { title: '搬運雜役' },
    employer: { name: '搬運領班' },
    workplace: { name: '初始聚落街口' },
    wagePerWork: 2,
  };
  view.progression.skills = [{ name: '近郊採集入門' }];
  view.progression.socialTags = [{ name: '搬運熟手' }];
  view.relationships = [{ npc: { name: '搬運領班' }, familiarity: { name: '見過幾面' } }];
  view.knowledge = [{ name: '初始聚落的基本生活去處' }];
  view.inventoryItems = [{ name: '飲用水', quantity: 1 }];

  const rows = buildCharacterSummaryRows(view);
  assert.deepEqual(rows.map(([key]) => key), [
    '姓名',
    '身分',
    '現職',
    '技能',
    '社會標籤',
    '關係',
    '已知情報',
    '貨幣',
    '飢餓',
    '口渴',
    '疲勞',
    '背包',
  ]);
  assert.equal(rows.find(([key]) => key === '現職')?.[1], '搬運雜役｜雇主：搬運領班｜工作地：初始聚落街口｜每次報酬：2');
  assert.equal(rows.find(([key]) => key === '背包')?.[1], '飲用水 × 1');
});
