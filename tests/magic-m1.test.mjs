import test from 'node:test';
import assert from 'node:assert/strict';
import { devStarterPack } from '../src/content/dev-starter.js';
import { validateContentPack } from '../src/content/validate-content-pack.js';
import { createDevelopmentGame } from '../src/game.js';
import { magicContentContract, resolveMagicTechnique } from '../src/modules/magic/index.js';

const actor = { sessionId: 'magic-m1-session' };

function fixturePack() {
  const pack = structuredClone(devStarterPack);
  pack.magic = {
    techniques: {
      'fixture-support': {
        name: '測試用術式',
        grade: 'basic',
        forbidden: false,
        domains: ['force', 'form'],
        effect: { resolverKey: 'test.support', parameters: { magnitude: 2, mode: 'fixture' } },
        limitations: ['test fixture only'],
        counterplay: ['test counter'],
        failureModes: ['test failure'],
      },
    },
  };
  return pack;
}

async function dispatch(runtime, requestId, type, payload = {}) {
  return runtime.dispatch({ actor, requestId, action: { type, payload } });
}
test('Magic M1 stays optional for existing Content Packs and exposes the R5 backend taxonomy', () => {
  assert.equal(validateContentPack(devStarterPack), devStarterPack);
  const pack = fixturePack();
  assert.equal(validateContentPack(pack), pack);
  assert.deepEqual(magicContentContract.grades, ['basic', 'intermediate', 'advanced', 'grand']);
  assert.equal(magicContentContract.domains.length, 25);
  assert.ok(magicContentContract.domains.includes('life'));
  assert.ok(magicContentContract.domains.includes('rune'));
});

test('Magic content rejects invented or malformed backend contracts', () => {
  const invalidGrade = fixturePack();
  invalidGrade.magic.techniques['fixture-support'].grade = 'mythic';
  assert.throws(() => validateContentPack(invalidGrade), /grade is not a supported world grade/);

  const unknownDomain = fixturePack();
  unknownDomain.magic.techniques['fixture-support'].domains = ['force', 'mana'];
  assert.throws(() => validateContentPack(unknownDomain), /not a known backend domain/);

  const duplicateDomain = fixturePack();
  duplicateDomain.magic.techniques['fixture-support'].domains = ['force', 'force'];
  assert.throws(() => validateContentPack(duplicateDomain), /duplicate domain/);

  const invalidForbidden = fixturePack();
  invalidForbidden.magic.techniques['fixture-support'].forbidden = 'yes';
  assert.throws(() => validateContentPack(invalidForbidden), /forbidden must be boolean/);
});
test('Magic content bounds resolver keys and deterministic parameter data', () => {
  const badResolver = fixturePack();
  badResolver.magic.techniques['fixture-support'].effect.resolverKey = 'TEST SUPPORT';
  assert.throws(() => validateContentPack(badResolver), /resolverKey is invalid/);

  const nonFinite = fixturePack();
  nonFinite.magic.techniques['fixture-support'].effect.parameters.magnitude = Infinity;
  assert.throws(() => validateContentPack(nonFinite), /finite numbers/);

  const tooDeep = fixturePack();
  tooDeep.magic.techniques['fixture-support'].effect.parameters = { a: { b: { c: { d: { e: { f: 1 } } } } } };
  assert.throws(() => validateContentPack(tooDeep), /too large/);
});

test('pure Magic resolver returns a proposal without mutating catalog or caller input', () => {
  const magic = fixturePack().magic;
  const beforeMagic = structuredClone(magic);
  const input = { target: { kind: 'fixture-object' }, amount: 3 };
  const beforeInput = structuredClone(input);
  const resolver = ({ input: safeInput, parameters }) => ({
    kind: 'fixture-proposal',
    amount: safeInput.amount * parameters.magnitude,
    targetKind: safeInput.target.kind,
  });
  const first = resolveMagicTechnique({ magic, techniqueId: 'fixture-support', input, effectResolvers: { 'test.support': resolver } });
  const second = resolveMagicTechnique({ magic, techniqueId: 'fixture-support', input, effectResolvers: { 'test.support': resolver } });
  assert.deepEqual(first, second);
  assert.deepEqual(first, { ok: true, code: 'MAGIC_EFFECT_RESOLVED', proposal: { techniqueId: 'fixture-support', effect: { kind: 'fixture-proposal', amount: 6, targetKind: 'fixture-object' } } });
  assert.deepEqual(magic, beforeMagic);
  assert.deepEqual(input, beforeInput);
  assert.equal('world' in first, false);
  assert.equal('events' in first, false);
});

test('Magic resolver fails closed on unknown techniques, missing resolvers, async resolvers, and invalid effects', () => {
  const magic = fixturePack().magic;
  assert.deepEqual(resolveMagicTechnique({ magic, techniqueId: 'missing', effectResolvers: {} }), { ok: false, code: 'MAGIC_TECHNIQUE_UNKNOWN' });
  assert.deepEqual(resolveMagicTechnique({ magic, techniqueId: 'fixture-support', effectResolvers: {} }), { ok: false, code: 'MAGIC_EFFECT_RESOLVER_UNAVAILABLE' });
  assert.deepEqual(resolveMagicTechnique({ magic, techniqueId: 'fixture-support', effectResolvers: { 'test.support': async () => ({ ok: true }) } }), { ok: false, code: 'MAGIC_EFFECT_RESOLVER_ASYNC' });
  assert.deepEqual(resolveMagicTechnique({ magic, techniqueId: 'fixture-support', effectResolvers: { 'test.support': () => null } }), { ok: false, code: 'MAGIC_EFFECT_INVALID' });
  assert.deepEqual(resolveMagicTechnique({ magic, techniqueId: 'fixture-support', effectResolvers: { 'test.support': () => { throw new Error('fixture'); } } }), { ok: false, code: 'MAGIC_EFFECT_RESOLUTION_FAILED' });
});

test('Magic M1 exposes no player-callable cast action and feature-off keeps ordinary gameplay usable', async () => {
  const enabledWithoutMagic = ['life', 'character', 'inventory', 'location', 'npc', 'purpose', 'survival', 'employment', 'economy', 'trade', 'crafting', 'progression', 'career', 'relationship', 'knowledge', 'estate', 'situation', 'narrative'];
  const game = createDevelopmentGame({ contentPack: fixturePack(), now: () => 1000, enabledModules: enabledWithoutMagic });
  const born = await dispatch(game.runtime, 'birth-no-magic', 'character.birth', { name: '無魔法模組旅人' });
  assert.equal(born.ok, true);
  const forged = await dispatch(game.runtime, 'forged-cast', 'magic.cast', { techniqueId: 'fixture-support' });
  assert.deepEqual(forged, { ok: false, code: 'UNKNOWN_ACTION' });
  const scene = await dispatch(game.runtime, 'scene-no-magic', 'narrative.scene');
  assert.equal(scene.ok, true);
  assert.equal(JSON.stringify(scene.data).includes('fixture-support'), false);
});