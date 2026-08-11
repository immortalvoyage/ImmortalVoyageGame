import assert from 'node:assert/strict';
import test from 'node:test';
import { createCharacterFromBirth, selectBirthRegion } from '../src/modules/character/index.js';

const regions = [
  { id: 'dune-edge', tags: ['desert'], weight: 1 },
  { id: 'tide-port', tags: ['coast', 'urban'], weight: 1 },
  { id: 'snow-pass', tags: ['cold', 'mountain'], weight: 1 },
];

test('origin preference changes birth weighting without fixing an exact location', () => {
  const picked = selectBirthRegion({ regions, preference: 'coast', random: () => 0.45 });
  assert.equal(picked.id, 'tide-port');
});

test('disabled birth regions are excluded', () => {
  const picked = selectBirthRegion({
    regions: [
      { id: 'closed-port', tags: ['coast'], birthAllowed: false },
      { id: 'open-port', tags: ['coast'] },
    ],
    preference: 'coast',
    random: () => 0,
  });
  assert.equal(picked.id, 'open-port');
});

test('character creation returns a complete alive character with rolled attributes and regional talents', () => {
  const character = createCharacterFromBirth({
    characterId: 'char-1',
    playerId: 'player-1',
    characterName: '沈無涯',
    regions: [{ id: 'sun-coast', tags: ['coast', 'island'] }],
    originPreference: 'coast',
    talentCount: 1,
    random: () => 0.2,
  });

  assert.equal(character.name, '沈無涯');
  assert.equal(character.birthRegionId, 'sun-coast');
  assert.equal(character.originPreference, 'coast');
  assert.equal(character.status, 'alive');
  assert.equal(Object.keys(character.attributes).length, 7);
  assert.equal(character.talents.length, 1);
  for (const score of Object.values(character.attributes)) {
    assert.ok(score >= 3 && score <= 18);
  }
});
