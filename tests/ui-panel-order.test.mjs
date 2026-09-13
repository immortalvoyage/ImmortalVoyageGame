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
test('global status feedback is accessible and precedes phase content', async () => {
  for (const name of ['index.html', 'tutorial.html', 'onboarding.html']) {
    const source = await html(name);
    const status = source.indexOf('id="status-panel"');
    assert.ok(status >= 0, `${name} must expose the global status panel`);
    assert.ok(source.includes('role="status" aria-live="polite" aria-atomic="true"'));
    assert.ok(status < source.indexOf('id="birth-panel"'));
    assert.ok(status < source.indexOf('id="game-panel"'));
  }

  const css = await readFile(new URL('app.css', publicDir), 'utf8');
  assert.match(css, /\.status-card\s*\{[^}]*position:\s*sticky;[^}]*top:\s*8px;[^}]*z-index:\s*5;[^}]*\}/s);
});
test('mobile layout prioritizes gameplay actions before full character detail', async () => {
  for (const name of ['index.html', 'tutorial.html', 'onboarding.html']) {
    const source = await html(name);
    assert.ok(source.includes('class="card location-card"'));
    assert.ok(source.includes('class="card character-card"'));
  }

  const css = await readFile(new URL('app.css', publicDir), 'utf8');
  const mobile = css.slice(css.indexOf('@media (max-width: 720px)'));
  assert.match(mobile, /#game-panel:not\(\[hidden\]\)\s*\{\s*display:\s*flex;\s*flex-direction:\s*column;/s);
  assert.match(mobile, /\.grid\s*\{\s*display:\s*contents;\s*\}/s);
  assert.match(mobile, /\.location-card\s*\{\s*order:\s*1;/s);
  assert.match(mobile, /#utility-panel\s*\{\s*order:\s*4;/s);
  assert.match(mobile, /\.character-card\s*\{\s*order:\s*6;/s);
});
