import test from 'node:test';
import assert from 'node:assert/strict';
import { devStarterPack } from '../src/content/dev-starter.js';
import { validateContentPack } from '../src/content/validate-content-pack.js';

function clonePack() {
  return structuredClone(devStarterPack);
}

test('valid known-at-start and topic NPC reveal rules pass', () => {
  assert.equal(validateContentPack(devStarterPack), devStarterPack);
});

test('knownAtStart must be boolean when configured', () => {
  const pack = clonePack();
  pack.npcs.foreman.knownAtStart = 'yes';
  assert.throws(() => validateContentPack(pack), /knownAtStart must be boolean/);
});

test('topic NPC reveals must reference existing NPCs', () => {
  const pack = clonePack();
  pack.npcs.foreman.relationship.levels[1].topics[0].revealsNpcIds = ['missing-npc'];
  assert.throws(() => validateContentPack(pack), /revealsNpcIds\[0\] references unknown npc: missing-npc/);
});

test('topic NPC reveal list must not be empty or contain duplicates', () => {
  const empty = clonePack();
  empty.npcs.foreman.relationship.levels[1].topics[0].revealsNpcIds = [];
  assert.throws(() => validateContentPack(empty), /revealsNpcIds must not be empty/);

  const duplicate = clonePack();
  duplicate.npcs.foreman.relationship.levels[1].topics[0].revealsNpcIds = ['herbalist', 'herbalist'];
  assert.throws(() => validateContentPack(duplicate), /revealsNpcIds contains duplicate value: herbalist/);
});
