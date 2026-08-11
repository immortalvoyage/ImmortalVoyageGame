import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const workerSource = fs.readFileSync(new URL('../src/worker.js', import.meta.url), 'utf8');

test('character creation preview is GET-only and does not submit to the birth route', () => {
  assert.match(workerSource, /request\.method === "GET" && url\.pathname === "\/preview\/character-creation"/);
  assert.match(workerSource, /replace\('action="\/character\/birth"', 'action="#"'\)/);
  assert.match(workerSource, /replace\('type="submit"', 'type="button"'\)/);
  assert.doesNotMatch(workerSource, /request\.method === "POST" && url\.pathname === "\/preview\/character-creation"/);
});

test('character creation preview clearly states that it does not write data', () => {
  assert.match(workerSource, /預覽模式 · 不會建立角色或寫入資料。/);
});
