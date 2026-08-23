import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevServer } from '../dev/server.mjs';

test('local dev server keeps browser behind server action boundary', async (t) => {
  const server = createDevServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;

  const page = await fetch(base + '/');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /default-src 'self'/);
  const cookie = page.headers.get('set-cookie').split(';')[0];

  const born = await fetch(base + '/api/action', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ requestId: 'server-birth', action: { type: 'character.birth', payload: { name: '本機旅人' } } }),
  });
  assert.equal(born.status, 200);

  const observed = await fetch(base + '/api/action', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ requestId: 'server-observe', action: { type: 'location.observe', payload: {} } }),
  });
  const data = await observed.json();
  assert.equal(data.data.character.name, '本機旅人');
  assert.equal(data.data.character.ownerSessionId, cookie.split('=')[1]);
});
