import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../src/worker.js', import.meta.url), 'utf8');

for (const marker of ['game-shell','character panel','scene panel','chronicle panel','action panel','@media(max-width:900px)']) {
  assert.ok(source.includes(marker), `missing game shell marker: ${marker}`);
}

for (const authMarker of ['DISCORD_CLIENT_SECRET','ALLOWED_DISCORD_USER_ID','verifySession','/auth/callback']) {
  assert.ok(source.includes(authMarker), `missing auth marker: ${authMarker}`);
}

console.log('game shell static checks passed');
