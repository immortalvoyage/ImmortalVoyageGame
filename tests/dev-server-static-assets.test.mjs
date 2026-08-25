import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createDevServer } from '../dev/server.mjs';

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server.address().port;
}

async function close(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function get(port, path) {
  return new Promise((resolve, reject) => {
    const request = http.get({ hostname: '127.0.0.1', port, path }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        statusCode: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    request.on('error', reject);
  });
}

test('dev server serves every direct browser module imported by app.js', async (t) => {
  const server = createDevServer({
    runtime: {
      async dispatch() {
        return { ok: false, code: 'UNUSED' };
      },
    },
  });
  const port = await listen(server);
  t.after(() => close(server));

  const app = await get(port, '/app.js');
  assert.equal(app.statusCode, 200);
  assert.match(app.headers['content-type'] ?? '', /^text\/javascript/);

  const importedModules = [...app.body.matchAll(/from\s+['"]\.\/([^'"]+)['"]/g)]
    .map((match) => match[1]);
  assert.equal(importedModules.length > 0, true);

  for (const moduleName of importedModules) {
    const asset = await get(port, `/${moduleName}`);
    assert.equal(asset.statusCode, 200, `${moduleName} must be served by the dev server`);
    assert.match(asset.headers['content-type'] ?? '', /^text\/javascript/);
    assert.equal(asset.body.length > 0, true);
  }
});
