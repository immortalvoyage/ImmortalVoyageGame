import test from 'node:test';
import assert from 'node:assert/strict';
import { addSkillProgress, createProfessionDiscoveryAnnouncement, evaluateProfessionCandidate, setCurrentProfession } from '../src/core/profession.js';

test('character keeps only one current profession while retaining skills', () => {
  let career = setCurrentProfession(null, 'sailor');
  career = addSkillProgress(career, 'navigation', 3);
  career = setCurrentProfession(career, 'merchant');
  assert.equal(career.currentProfessionId, 'merchant');
  assert.equal(career.skills.navigation, 3);
});

test('shared professional skills are not tied to one profession', () => {
  let career = setCurrentProfession(null, 'blacksmith');
  career = addSkillProgress(career, 'metalworking', 2);
  career = setCurrentProfession(career, 'soldier');
  assert.equal(career.skills.metalworking, 2);
});

test('new profession requires longitudinal evidence', () => {
  const result = evaluateProfessionCandidate({ id: 'cartographer', name: '海圖師', skills: ['navigation','mapping'], incomeMethods: ['chart_commission'], capabilities: ['sailing'], evidence: ['one'] });
  assert.equal(result.reason, 'insufficient_longitudinal_evidence');
});

test('world-incompatible profession is rejected', () => {
  const result = evaluateProfessionCandidate({ id: 'astronaut', name: '太空人', skills: ['orbital_navigation'], incomeMethods: ['space_mission'], capabilities: ['spaceflight'], evidence: ['a','b','c'] });
  assert.equal(result.reason, 'world_era_incompatible');
});

test('equivalent existing profession does not create a renamed duplicate', () => {
  const existing = [{ id: 'sailor', name: '水手', skills: ['navigation','ropework'], incomeMethods: ['ship_wage'], capabilities: ['sailing'] }];
  const result = evaluateProfessionCandidate({ id: 'royal-sailor', name: '皇家水手', skills: ['ropework','navigation'], incomeMethods: ['ship_wage'], capabilities: ['sailing'], evidence: ['a','b','c'] }, { existingProfessions: existing });
  assert.equal(result.reason, 'equivalent_existing_profession');
  assert.equal(result.equivalentProfessionId, 'sailor');
});

test('valid new profession can be announced without revealing unlock conditions', () => {
  const result = evaluateProfessionCandidate({ id: 'sea-cartographer', name: '海圖師', skills: ['navigation','mapping'], incomeMethods: ['chart_commission'], tools: ['chart_tools'], places: ['harbor'], capabilities: ['sailing'], evidence: ['voyage-1','voyage-2','commission-1'] });
  assert.equal(result.accepted, true);
  const announcement = createProfessionDiscoveryAnnouncement({ professionName: result.profession.name, pioneerName: '沈無涯' });
  assert.equal(announcement.professionName, '海圖師');
  assert.equal(announcement.discloseUnlockConditions, false);
});
