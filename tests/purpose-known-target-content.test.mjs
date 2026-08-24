import test from 'node:test';
import assert from 'node:assert/strict';
import { devStarterPack } from '../src/content/dev-starter.js';
import { validateContentPack } from '../src/content/validate-content-pack.js';

function clonePack() {
  return structuredClone(devStarterPack);
}

test('valid public and initially hidden NPC discovery config passes', () => {
  assert.equal(validateContentPack(devStarterPack), devStarterPack);
  assert.equal(devStarterPack.npcs.foreman.knownAtStart, true);
  assert.equal(devStarterPack.npcs.herbalist.knownAtStart, undefined);
});

test('knownAtStart may be true or false when configured', () => {
  const publicPack = clonePack();
  publicPack.npcs.herbalist.knownAtStart = true;
  assert.equal(validateContentPack(publicPack), publicPack);

  const hiddenPack = clonePack();
  hiddenPack.npcs.foreman.knownAtStart = false;
  assert.equal(validateContentPack(hiddenPack), hiddenPack);
});

test('knownAtStart must be boolean when configured', () => {
  const pack = clonePack();
  pack.npcs.foreman.knownAtStart = 'yes';
  assert.throws(() => validateContentPack(pack), /knownAtStart must be boolean/);
});
