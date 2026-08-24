import test from 'node:test';
import assert from 'node:assert/strict';
import { devStarterPack } from '../src/content/dev-starter.js';
import { validateContentPack } from '../src/content/validate-content-pack.js';

function clonePack() {
  return structuredClone(devStarterPack);
}

test('knowledge catalog and valid topic grants pass validation', () => {
  assert.equal(validateContentPack(devStarterPack), devStarterPack);
});

test('knowledge catalog is required and fact names must be public non-empty text', () => {
  const missing = clonePack();
  delete missing.knowledge;
  assert.throws(() => validateContentPack(missing), /pack\.knowledge must be an object/);

  const badName = clonePack();
  badName.knowledge['starter-living-advice'].name = '';
  assert.throws(() => validateContentPack(badName), /knowledge\.starter-living-advice\.name must be non-empty text/);
});

test('knowledge NPC reveal references must be non-empty, unique, and valid', () => {
  const empty = clonePack();
  empty.knowledge['npc-rumor'] = { name: '某人的傳聞', revealsNpcIds: [] };
  assert.throws(() => validateContentPack(empty), /knowledge\.npc-rumor\.revealsNpcIds must not be empty/);

  const duplicate = clonePack();
  duplicate.knowledge['npc-rumor'] = { name: '某人的傳聞', revealsNpcIds: ['foreman', 'foreman'] };
  assert.throws(() => validateContentPack(duplicate), /revealsNpcIds contains duplicate value: foreman/);

  const unknown = clonePack();
  unknown.knowledge['npc-rumor'] = { name: '某人的傳聞', revealsNpcIds: ['missing-npc'] };
  assert.throws(() => validateContentPack(unknown), /references unknown npc: missing-npc/);
});

test('topic knowledge grants must be non-empty, unique, and reference declared facts', () => {
  const topicOf = (pack) => pack.npcs.foreman.relationship.levels[1].topics[0];

  const empty = clonePack();
  topicOf(empty).grantsKnowledgeIds = [];
  assert.throws(() => validateContentPack(empty), /grantsKnowledgeIds must not be empty/);

  const duplicate = clonePack();
  topicOf(duplicate).grantsKnowledgeIds = ['starter-living-advice', 'starter-living-advice'];
  assert.throws(() => validateContentPack(duplicate), /grantsKnowledgeIds contains duplicate value: starter-living-advice/);

  const unknown = clonePack();
  topicOf(unknown).grantsKnowledgeIds = ['missing-fact'];
  assert.throws(() => validateContentPack(unknown), /references unknown knowledge: missing-fact/);
});
