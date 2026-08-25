import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { firstSettlementPack } from '../src/content/first-settlement.js';
import { createFileBackedDevelopmentGame } from '../src/game.js';
import { createDeveloperTestSession } from '../src/core/auth-session.js';
import { LOCAL_DEVELOPMENT_ENVIRONMENT } from '../src/core/runtime-environment.js';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, '..', 'public');
const MAX_BODY_BYTES = 16 * 1024;

const STATIC_FILES = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/action-client.js', ['action-client.js', 'text/javascript; charset=utf-8']],
  ['/action-recovery-state.js', ['action-recovery-state.js', 'text/javascript; charset=utf-8']],
  ['/character-summary.js', ['character-summary.js', 'text/javascript; charset=utf-8']],
  ['/result-message.js', ['result-message.js', 'text/javascript; charset=utf-8']],
  ['/scene-visibility.js', ['scene-visibility.js', 'text/javascript; charset=utf-8']],
  ['/trade-visibility.js', ['trade-visibility.js', 'text/javascript; charset=utf-8']],
  ['/app.css', ['app.css', 'text/css; charset=utf-8']],
]);

function parseCookies(header = '') {
  return Object.fromEntries(
    header.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
      const index = part.indexOf('=');
      return index === -1 ? [part, ''] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
    }),
  );
}

function sessionFor(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.iv_session) return cookies.iv_session;
  const sessionId = randomUUID();
  res.setHeader('Set-Cookie', `iv_session=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax`);
  return sessionId;
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('request body too large'), { statusCode: 413 });
    chunks.push(chunk);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('invalid json'), { statusCode: 400 });
  }
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(JSON.stringify(body));
}

export function createDevServer({ runtime, contentPack, filePath } = {}) {
  const authoritativeRuntime = runtime ?? createFileBackedDevelopmentGame({
    filePath: filePath ?? join(here, '..', '.data', 'world.json'),
    ...(contentPack ? { contentPack } : {}),
  }).runtime;
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'POST' && url.pathname === '/api/action') {
        const sessionId = sessionFor(req, res);
        const { actor } = createDeveloperTestSession({
          environment: LOCAL_DEVELOPMENT_ENVIRONMENT,
          accountId: `local-dev:${sessionId}`,
          sessionId,
        });
        const body = await readJson(req);
        const result = await authoritativeRuntime.dispatch({
          actor,
          requestId: body.requestId,
          action: body.action,
        });
        sendJson(res, result.ok ? 200 : 400, result);
        return;
      }

      const staticFile = STATIC_FILES.get(url.pathname);
      if (req.method === 'GET' && staticFile) {
        sessionFor(req, res);
        const [name, contentType] = staticFile;
        const body = await readFile(join(publicDir, name));
        res.writeHead(200, {
          'content-type': contentType,
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
          'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
        });
        res.end(body);
        return;
      }

      sendJson(res, 404, { ok: false, code: 'NOT_FOUND' });
    } catch (error) {
      sendJson(res, error.statusCode ?? 500, { ok: false, code: error.statusCode ? 'BAD_REQUEST' : 'INTERNAL_ERROR' });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const useFirstSettlement = process.argv.includes('--first-settlement');
  const server = useFirstSettlement
    ? createDevServer({
      contentPack: firstSettlementPack,
      filePath: join(here, '..', '.data', 'first-settlement-world.json'),
    })
    : createDevServer();
  const port = Number(process.env.PORT ?? 8787);
  server.listen(port, '127.0.0.1', () => {
    const mode = useFirstSettlement ? ' first-settlement' : '';
    console.log(`ImmortalVoyage V2${mode} local dev server: http://127.0.0.1:${port}`);
  });
}
