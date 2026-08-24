import test from 'node:test';
import assert from 'node:assert/strict';
import { devStarterPack } from '../src/content/dev-starter.js';
import { validateContentPack } from '../src/content/validate-content-pack.js';

function clonePack() {
  return structuredClone(devStarterPack);
}

test('starter public NPC discovery config passes', () => {
  assert.equal(validateContentPack(devStarterPack), devStarterPack);
  assert.equal(devStarterPack.npcs.foreman.knownAtStart, true);
});

test('knownAtStart may be omitted, true, or false', () => {
  const omitted = clonePack();
  delete omitted.npcs.foreman.knownAtStart;
  assert.equal(validateContentPack(omitted), omitted);

  const publicPack = clonePack();
  publicPack.npcs.foreman.knownAtStart = true;
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
