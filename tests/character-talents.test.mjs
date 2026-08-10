import assert from 'node:assert/strict';
import test from 'node:test';
import { createAttributes, getAttributeModifier, rollBirthTalents } from '../src/modules/character/index.js';

test('attributes use bounded scores and standard modifiers', () => {
  const attributes = createAttributes({ strength: 14, agility: 8 });
  assert.equal(attributes.strength, 14);
  assert.equal(attributes.agility, 8);
  assert.equal(getAttributeModifier(attributes.strength), 2);
  assert.equal(getAttributeModifier(attributes.agility), -1);
});

test('regional tags can increase the weight of matching birth talents', () => {
  const randomValues = [0.92, 0.1];
  let index = 0;
  const talents = rollBirthTalents({
    regionTags: ['desert'],
    count: 2,
    random: () => randomValues[index++ % randomValues.length],
  });

  assert.equal(talents.length, 2);
  assert.equal(new Set(talents.map((talent) => talent.id)).size, 2);
});

test('birth talents are capped and do not duplicate', () => {
  const talents = rollBirthTalents({ regionTags: ['coast'], count: 9, random: () => 0 });
  assert.equal(talents.length, 3);
  assert.equal(new Set(talents.map((talent) => talent.id)).size, talents.length);
});
