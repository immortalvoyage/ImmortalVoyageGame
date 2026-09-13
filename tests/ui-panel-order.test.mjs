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
  assert.match(css, /\.status-card\s*\{[^}]*flex:\s*0 0 auto;[^}]*position:\s*relative;[^}]*z-index:\s*5;[^}]*\}/s);
});
test('compact layout keeps location context visible while detail surfaces are tabbed', async () => {
  for (const name of ['index.html', 'tutorial.html', 'onboarding.html']) {
    const source = await html(name);
    assert.ok(source.includes('class="card location-card"'));
    assert.ok(source.includes('class="card character-card"'));
  }

  const css = await readFile(new URL('app.css', publicDir), 'utf8');
  const mobile = css.slice(css.indexOf('@media (max-width: 1024px)'));
  assert.match(mobile, /#game-panel:not\(\[hidden\]\)\s*\{\s*display:\s*flex;\s*flex-direction:\s*column;/s);
  assert.match(mobile, /\.grid\s*\{\s*display:\s*contents;\s*\}/s);
  assert.match(mobile, /\.character-card, #travel-panel, #dialogue-panel, #utility-panel, #trade-panel, #leave-tutorial-panel\s*\{\s*display:\s*none !important;/s);
  assert.match(mobile, /#game-panel\[data-mobile-tab="actions"\] #utility-panel:not\(\[hidden\]\)/s);
  assert.match(mobile, /#game-panel\[data-mobile-tab="character"\] \.character-card/s);
});

test('compact gameplay uses one operation surface instead of stacking every panel', async () => {
  for (const name of ['index.html', 'tutorial.html', 'onboarding.html']) {
    const source = await html(name);
    assert.ok(source.includes('id="mobile-game-nav"'));
    for (const tab of ['travel', 'dialogue', 'actions', 'character']) {
      assert.ok(source.includes(`data-mobile-tab="${tab}"`), `${name} must expose ${tab} mobile tab`);
    }
  }

  const css = await readFile(new URL('app.css', publicDir), 'utf8');
  const mobile = css.slice(css.indexOf('@media (max-width: 1024px)'));
  assert.match(mobile, /\.mobile-game-nav\s*\{[^}]*display:\s*grid;/s);
  assert.match(mobile, /#game-panel\[data-mobile-tab="actions"\] #utility-panel:not\(\[hidden\]\)/s);
  assert.match(mobile, /#game-panel\[data-mobile-tab="character"\] \.character-card/s);
  assert.match(mobile, /header h1\s*\{[^}]*font-size:\s*1\.65rem;/s);
  assert.match(mobile, /button\s*\{[^}]*min-height:\s*44px;/s);
});

test('browser shell is fixed to the viewport and compact navigation stays outside the scrollable detail surface', async () => {
  const css = await readFile(new URL('app.css', publicDir), 'utf8');
  assert.match(css, /html, body\s*\{[^}]*height:\s*100%;[^}]*overflow:\s*hidden;/s);
  assert.match(css, /\.shell\s*\{[^}]*height:\s*100dvh;[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*overflow:\s*hidden;/s);
  assert.match(css, /#game-panel:not\(\[hidden\]\)\s*\{[^}]*flex:\s*1 1 auto;[^}]*min-height:\s*0;/s);

  const compact = css.slice(css.indexOf('@media (max-width: 1024px)'));
  assert.match(compact, /#game-panel:not\(\[hidden\]\)\s*\{[^}]*overflow:\s*hidden;/s);
  assert.match(compact, /\.location-card\s*\{[^}]*flex:\s*0 0 auto;/s);
  assert.match(compact, /\.mobile-game-nav\s*\{[^}]*flex:\s*0 0 auto;[^}]*display:\s*grid;/s);
  assert.match(compact, /#travel-panel, #dialogue-panel, #utility-panel, #trade-panel, #leave-tutorial-panel[^}]*overflow:\s*auto;/s);
});
