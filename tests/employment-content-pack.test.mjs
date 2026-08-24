import test from 'node:test';
import assert from 'node:assert/strict';
import { devStarterPack } from '../src/content/dev-starter.js';
import { validateContentPack } from '../src/content/validate-content-pack.js';

function clonePack() {
  return structuredClone(devStarterPack);
}

test('starter Content Pack declares a valid employer-backed job', () => {
  assert.equal(validateContentPack(devStarterPack), devStarterPack);
  const job = devStarterPack.locations['starter-square'].jobs[0];
  assert.equal(job.title, '聚落雜役');
  assert.equal(job.employerNpcId, 'foreman');
});

test('jobs require a public title and an existing employer NPC', () => {
  const missingTitle = clonePack();
  delete missingTitle.locations['starter-square'].jobs[0].title;
  assert.throws(() => validateContentPack(missingTitle), /title must be non-empty text/);

  const missingEmployer = clonePack();
  delete missingEmployer.locations['starter-square'].jobs[0].employerNpcId;
  assert.throws(() => validateContentPack(missingEmployer), /employerNpcId must be non-empty text/);

  const unknownEmployer = clonePack();
  unknownEmployer.locations['starter-square'].jobs[0].employerNpcId = 'missing-employer';
  assert.throws(() => validateContentPack(unknownEmployer), /references unknown npc/);
});

test('minimal stationary jobs require the employer NPC at the work location', () => {
  const remoteEmployer = clonePack();
  remoteEmployer.npcs.foreman.locationId = 'starter-well';
  assert.throws(() => validateContentPack(remoteEmployer), /must reference an npc at the work location/);
});
