import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePlayerDisplayName } from '../src/modules/character/player-name.js';
import { createDevelopmentGame } from '../src/game.js';

function valid(name) {
  const result = validatePlayerDisplayName(name);
  assert.equal(result.ok, true, `${name} should be valid`);
  return result;
}

function invalid(name, reason) {
  const result = validatePlayerDisplayName(name);
  assert.equal(result.ok, false, `${JSON.stringify(name)} should be invalid`);
  if (reason) assert.equal(result.reason, reason);
}

test('player display names support normal CJK and multilingual names', () => {
  assert.equal(valid('林冬').name, '林冬');
  assert.equal(valid('Élodie').name, 'Élodie');
  assert.equal(valid('O’Connor').name, 'O’Connor');
  assert.equal(valid('阿史那·云').name, '阿史那·云');
});

test('player display names normalize compatibility forms and surrounding space', () => {
  assert.equal(valid('  Ａlice　Lin  ').name, 'Alice Lin');
  assert.equal(valid('Cafe\u0301').name, 'Café');
});

test('reserved official identities reject normalized and confusable variants', () => {
  for (const name of ['GM', 'ＧＭ', 'admin123', 'аdmin', '知微', '長生', '老祖', '官方']) {
    invalid(name, 'reserved');
  }
});

test('unsafe format controls and unsupported visual spoofing characters fail closed', () => {
  invalid('A\u200bB', 'unsafe-format');
  invalid('A\u202eB', 'unsafe-format');
  invalid('A\nB', 'unsafe-format');
  invalid('旅人😀', 'unsupported-character');
  invalid('----', 'unsupported-character');
});

test('obvious sensitive data and bounded harmful phrases are rejected', () => {
  invalid('旅人0912345678', 'sensitive-data');
  invalid('White Power', 'blocked-content');
  invalid('殺你全家', 'blocked-content');
});

test('duplicate display names remain legal identity labels, not ownership keys', async () => {
  const game = createDevelopmentGame({ now: () => 1000 });
  const first = await game.runtime.dispatch({
    actor: { sessionId: 'name-a' }, requestId: 'name-a-birth',
    action: { type: 'character.birth', payload: { name: '同名旅人' } },
  });
  const second = await game.runtime.dispatch({
    actor: { sessionId: 'name-b' }, requestId: 'name-b-birth',
    action: { type: 'character.birth', payload: { name: '同名旅人' } },
  });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.notEqual(first.data.character.id, second.data.character.id);
  assert.equal(first.data.character.name, second.data.character.name);
});

test('invalid naming is atomic and canonical normalization is what gets stored', async () => {
  const game = createDevelopmentGame({ now: () => 1000 });
  const before = game.store.snapshot();
  const rejected = await game.runtime.dispatch({
    actor: { sessionId: 'name-invalid' }, requestId: 'invalid-birth',
    action: { type: 'character.birth', payload: { name: 'ＧＭ' } },
  });
  assert.equal(rejected.code, 'INVALID_NAME');
  assert.deepEqual(game.store.snapshot(), before);

  const accepted = await game.runtime.dispatch({
    actor: { sessionId: 'name-normalized' }, requestId: 'normalized-birth',
    action: { type: 'character.birth', payload: { name: '  Ａlice　Lin  ' } },
  });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.data.character.name, 'Alice Lin');
  assert.equal(game.store.snapshot().characters['name-normalized'].name, 'Alice Lin');
});
