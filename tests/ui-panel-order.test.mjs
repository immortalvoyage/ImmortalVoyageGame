import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const publicDir = new URL('../public/', import.meta.url);

async function html(name) {
  return readFile(new URL(name, publicDir), 'utf8');
}

test('all browser shells use a real dialogue heading', async () => {
  for (const name of ['index.html', 'tutorial.html', 'onboarding.html']) {
    const source = await html(name);
    assert.ok(source.includes('<h2>對話</h2>'), `${name} must label the dialogue surface`);
    assert.equal(source.includes('<h2>??</h2>'), false);
  }
});

test('tutorial exit decision comes after current gameplay surfaces', async () => {
  const source = await html('onboarding.html');
  const leave = source.indexOf('id="leave-tutorial-panel"');
  assert.ok(source.indexOf('id="travel-panel"') < leave);
  assert.ok(source.indexOf('id="dialogue-panel"') < leave);
  assert.ok(source.indexOf('id="utility-panel"') < leave);
  assert.ok(source.indexOf('id="trade-panel"') < leave);
  assert.ok(leave < source.indexOf('id="formal-birth-panel"'));
});
