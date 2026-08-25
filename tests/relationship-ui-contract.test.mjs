import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Browser relationship rendering consumes only public relationship fields', async () => {
  const appSource = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const source = await readFile(new URL('../public/character-summary.js', import.meta.url), 'utf8');
  assert.match(appSource, /buildCharacterSummaryRows\(view\)/);
  assert.match(source, /relationship\.npc\.name/);
  assert.match(source, /relationship\.familiarity\.name/);
  assert.equal(source.includes('relationship.behaviorId'), false);
  assert.equal(source.includes('relationship.minCount'), false);
  assert.equal(source.includes('relationship.count'), false);
});
