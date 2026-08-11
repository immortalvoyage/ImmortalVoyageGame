import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBugReward, classifyBugSeverity, createBugReport, sanitizePublicBugRecognition } from '../src/core/bug-report.js';

test('bug report stores description and at most three attachment descriptors', () => {
  const report = createBugReport({
    reportId: 'BUG-1',
    playerId: 'player-1',
    characterId: 'char-1',
    description: '交易後物品重複出現',
    attachments: [{ name: 'proof.png', contentType: 'image/png', size: 1234 }],
    context: { worldVersion: '42', route: '/trade' },
  });
  assert.equal(report.state, 'submitted');
  assert.equal(report.attachments.length, 1);
  assert.equal(report.context.worldVersion, '42');
});

test('bug report rejects more than three attachments', () => {
  assert.throws(() => createBugReport({ reportId: 'BUG-2', playerId: 'p', description: 'x', attachments: [1,2,3,4] }), /at most 3/);
});

test('severity escalates security economy and world integrity issues to S4', () => {
  assert.equal(classifyBugSeverity({ economyExploit: true }), 'S4');
  assert.equal(classifyBugSeverity({ authorizationBypass: true }), 'S4');
  assert.equal(classifyBugSeverity({ worldIntegrityRisk: true }), 'S4');
});

test('severity distinguishes visual gameplay and data issues', () => {
  assert.equal(classifyBugSeverity({ visualOnly: true }), 'S0');
  assert.equal(classifyBugSeverity({}), 'S1');
  assert.equal(classifyBugSeverity({ gameplayBlocked: true }), 'S2');
  assert.equal(classifyBugSeverity({ dataCorruption: true }), 'S3');
});

test('higher severity yields contribution policy without direct economy payout', () => {
  assert.equal(buildBugReward('S4').contributionPoints, 50);
  assert.equal(buildBugReward('S4').worldRecognition, true);
  assert.equal('gold' in buildBugReward('S4'), false);
});

test('S4 public recognition hides exploit details', () => {
  const recognition = sanitizePublicBugRecognition({ severity: 'S4', playerName: '沈無涯' });
  assert.equal(recognition.title, '世界守望者');
  assert.equal(recognition.discloseDetails, false);
  assert.match(recognition.text, /重大世界異常/);
});
