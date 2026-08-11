import test from 'node:test';
import assert from 'node:assert/strict';
import { assertCharacterName, normalizeCharacterName, validateCharacterName } from '../src/modules/character/character-name.js';

test('accepts common names from multiple writing systems', () => {
  for (const name of ['沈無涯', 'Johann Müller', 'Élodie', '김민수', 'さくら', "D'Arcy", 'Anne-Marie']) {
    assert.equal(validateCharacterName(name).valid, true, name);
  }
});

test('normalizes surrounding and repeated spaces', () => {
  assert.equal(normalizeCharacterName('  Johann   Müller  '), 'Johann Müller');
});

test('rejects hidden control or zero-width formatting characters', () => {
  assert.equal(validateCharacterName('Jo\u200Bhann').reason, 'name_forbidden_format');
  assert.equal(validateCharacterName('Jo\nhann').reason, 'name_forbidden_format');
});

test('rejects unsupported punctuation and emoji', () => {
  assert.equal(validateCharacterName('Johann!').reason, 'name_invalid_characters');
  assert.equal(validateCharacterName('勇者🔥').reason, 'name_invalid_characters');
});

test('rejects reserved official identities', () => {
  assert.equal(validateCharacterName('GM').reason, 'name_reserved');
  assert.equal(validateCharacterName('ImmortalVoyage').reason, 'name_reserved');
  assert.equal(validateCharacterName('仙遊者').reason, 'name_reserved');
});

test('rejects names outside grapheme limits', () => {
  assert.equal(validateCharacterName('李').reason, 'name_too_short');
  assert.equal(validateCharacterName('abcdefghijklmnopqrstuvwxy').reason, 'name_too_long');
});

test('assertCharacterName returns the normalized accepted name', () => {
  assert.equal(assertCharacterName('  Élodie  '), 'Élodie');
});
