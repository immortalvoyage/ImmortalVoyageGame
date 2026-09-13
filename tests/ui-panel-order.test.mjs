import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const publicDir = new URL('../public/', import.meta.url);
async function html(name) { return readFile(new URL(name, publicDir), 'utf8'); }

const views = ['scene', 'travel', 'dialogue', 'actions', 'trade', 'character'];

test('all browser shells expose one fixed workspace navigation model', async () => {
  for (const name of ['index.html', 'tutorial.html', 'onboarding.html']) {
    const source = await html(name);
    assert.ok(source.includes('class="workspace-nav"'));
    for (const view of views) assert.ok(source.includes(`data-mobile-tab="${view}"`), `${name} missing ${view}`);
    assert.ok(source.includes('data-workspace-view="scene"'));
    assert.ok(source.includes('data-workspace-view="character"'));
  }
});

test('world surfaces are views instead of vertically stacked gameplay sections', async () => {
  for (const name of ['index.html', 'tutorial.html', 'onboarding.html']) {
    const source = await html(name);
    assert.ok(source.includes('data-workspace-view="travel"'));
    assert.ok(source.includes('data-workspace-view="dialogue"'));
    assert.ok(source.includes('data-workspace-view="actions"'));
    assert.ok(source.includes('data-workspace-view="trade"'));
  }
  const onboarding = await html('onboarding.html');
  assert.match(onboarding, /id="leave-tutorial-panel"[^>]*data-workspace-view="character"/);
});
test('fixed workspace forbids document and gameplay scrolling', async () => {
  const css = await readFile(new URL('app.css', publicDir), 'utf8');
  assert.match(css, /html, body\s*\{[^}]*overflow:\s*hidden;/s);
  assert.match(css, /\.shell\s*\{[^}]*height:\s*100dvh;[^}]*overflow:\s*hidden;/s);
  assert.match(css, /#game-panel:not\(\[hidden\]\)\s*\{[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\);[^}]*overflow:\s*hidden;/s);
  assert.match(css, /\.workspace-view\s*\{[^}]*height:\s*100%;[^}]*overflow:\s*hidden;[^}]*display:\s*none;/s);
  assert.equal(/overflow:\s*(?:auto|scroll)/.test(css), false, 'gameplay CSS must not reintroduce scrolling containers');
  const desktop = css.slice(css.indexOf('@media (min-width: 721px)'));
  assert.match(desktop, /#game-panel:not\(\[hidden\]\)\s*\{[^}]*grid-template-columns:/s);
  assert.match(desktop, /\[data-workspace-view=\"scene\"\]\s*\{[^}]*display:\s*flex !important;[^}]*grid-column:\s*1;/s);
  assert.match(desktop, /\[data-workspace-view=\"actions\"\][^}]*grid-column:\s*2;/s);
});

test('workspace keeps trade separate and paginates bounded detail lists', async () => {
  const source = await readFile(new URL('app.js', publicDir), 'utf8');
  assert.match(source, /ACTION_PAGE_SIZE\s*=\s*4/);
  assert.match(source, /CHARACTER_PAGE_SIZE\s*=\s*8/);
  assert.match(source, /TRADE_PAGE_SIZE\s*=\s*2/);
  assert.match(source, /renderPagedButtons\(travelActions/);
  assert.match(source, /renderPagedButtons\(dialogueActions/);
  assert.match(source, /renderPagedButtons\(worldActions/);
  assert.match(source, /trade:\s*!tradePanel\.hidden/);
  assert.doesNotMatch(source, /actions:\s*!utilityPanel\.hidden\s*\|\|\s*!tradePanel\.hidden/);
});

test('global action feedback remains accessible without becoming a scroll anchor', async () => {
  for (const name of ['index.html', 'tutorial.html', 'onboarding.html']) {
    const source = await html(name);
    assert.ok(source.includes('role="status" aria-live="polite" aria-atomic="true"'));
  }
});
