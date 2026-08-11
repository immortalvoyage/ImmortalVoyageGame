import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const workerSource = fs.readFileSync(new URL('../src/worker.js', import.meta.url), 'utf8');

test('game pages include an empty ad slot that stays hidden until populated', () => {
  assert.match(workerSource, /class=\\"ad-slot\\"/);
  assert.match(workerSource, /\.ad-slot:empty\{display:none\}/);
});

test('mobile birth layout uses full viewport without fixed-height clipping', () => {
  assert.match(workerSource, /\.birth\{width:100%;height:auto;min-height:100svh/);
  assert.match(workerSource, /\.birth-frame\{min-height:calc\(100svh - 16px\)/);
});
