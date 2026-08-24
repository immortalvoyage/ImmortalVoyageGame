import test from 'node:test';
import assert from 'node:assert/strict';
import { devStarterPack } from '../src/content/dev-starter.js';
import { validateContentPack } from '../src/content/validate-content-pack.js';

function clonePack() {
  return structuredClone(devStarterPack);
}

test('NPC relationship rules are optional but valid configured rules pass', () => {
  assert.equal(validateContentPack(devStarterPack), devStarterPack);

  const withoutRelationship = clonePack();
  delete withoutRelationship.npcs.foreman.relationship;
  assert.equal(validateContentPack(withoutRelationship), withoutRelationship);
});

test('NPC relationship rules reject missing behavior or empty levels', () => {
  const missingBehavior = clonePack();
  delete missingBehavior.npcs.foreman.relationship.behaviorId;
  assert.throws(() => validateContentPack(missingBehavior), /relationship\.behaviorId must be non-empty text/);

  const emptyLevels = clonePack();
  emptyLevels.npcs.foreman.relationship.levels = [];
  assert.throws(() => validateContentPack(emptyLevels), /relationship\.levels must not be empty/);
});

test('NPC familiarity thresholds must increase and public names must be unique', () => {
  const unordered = clonePack();
  unordered.npcs.foreman.relationship.levels[1].minCount = 1;
  assert.throws(() => validateContentPack(unordered), /strictly increasing minCount/);

  const duplicateName = clonePack();
  duplicateName.npcs.foreman.relationship.levels[1].name = duplicateName.npcs.foreman.relationship.levels[0].name;
  assert.throws(() => validateContentPack(duplicateName), /level names contains duplicate value/);
});

test('NPC interaction behavior is a declared behavior source for derived rules', () => {
  const pack = clonePack();
  pack.progressionTags['starter-odd-job-regular'].requirements = [
    { behaviorId: 'interact:npc:foreman', minCount: 2 },
  ];
  assert.equal(validateContentPack(pack), pack);
});
