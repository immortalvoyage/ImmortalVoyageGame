import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('public first-session shell does not expose development-only framing', async () => {
  const source = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /DEV SLICE/i);
  assert.doesNotMatch(source, /deterministic/i);
  assert.doesNotMatch(source, /V2 開發切片/);
  assert.match(source, /<title>不朽之旅<\/title>/);
  assert.match(source, /id="utility-panel"[^>]*hidden/);
});
