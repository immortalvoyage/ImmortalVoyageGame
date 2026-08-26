import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { firstSettlementPack } from '../src/content/first-settlement.js';
import { createFileBackedDevelopmentGame, createTutorialDevelopmentGame } from '../src/game.js';
import { createDeveloperTestSession } from '../src/core/auth-session.js';
import { LOCAL_DEVELOPMENT_ENVIRONMENT, LOCAL_ONBOARDING_ENVIRONMENT, LOCAL_TUTORIAL_ENVIRONMENT } from '../src/core/runtime-environment.js';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, '..', 'public');
const MAX_BODY_BYTES = 16 * 1024;

const STATIC_FILES = new Map([
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

export function createDevServer({ runtime, contentPack, filePath, entryFile = 'index.html', runtimeEnvironment = LOCAL_DEVELOPMENT_ENVIRONMENT, actionHandler = null } = {}) {
  if (actionHandler !== null && typeof actionHandler !== 'function') throw new TypeError('actionHandler must be a function');
  const authoritativeRuntime = runtime ?? (actionHandler ? null : createFileBackedDevelopmentGame({
    filePath: filePath ?? join(here, '..', '.data', 'world.json'),
    ...(contentPack ? { contentPack } : {}),
  }).runtime);
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'POST' && url.pathname === '/api/action') {
        const sessionId = sessionFor(req, res);
        const body = await readJson(req);
        const result = actionHandler
          ? await actionHandler({ sessionId, body })
          : await authoritativeRuntime.dispatch({
            actor: createDeveloperTestSession({
              environment: runtimeEnvironment,
              accountId: `local-dev:${sessionId}`,
              sessionId,
            }).actor,
            requestId: body.requestId,
            action: body.action,
          });
        sendJson(res, result.ok ? 200 : 400, result);
        return;
      }

      const staticFile = url.pathname === '/'
        ? [entryFile, 'text/html; charset=utf-8']
        : STATIC_FILES.get(url.pathname);
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

export function createTutorialDevServer() {
  const { runtime } = createTutorialDevelopmentGame();
  return createDevServer({
    runtime,
    entryFile: 'tutorial.html',
    runtimeEnvironment: LOCAL_TUTORIAL_ENVIRONMENT,
  });
}

function onboardingAccountId(sessionId) {
  return `local-onboarding:${sessionId}`;
}

export function createOnboardingDevServer({ filePath = join(here, '..', '.data', 'onboarding-formal-world.json'), now = () => Date.now() } = {}) {
  const formalGame = createFileBackedDevelopmentGame({
    filePath,
    now,
    contentPack: firstSettlementPack,
    lifeBirthPolicy: 'pending-required',
    runtimeEnvironment: LOCAL_ONBOARDING_ENVIRONMENT,
  });
  const tutorialGames = new Map();

  function tutorialGameFor(sessionId) {
    let game = tutorialGames.get(sessionId);
    if (!game) {
      game = createTutorialDevelopmentGame({ now });
      tutorialGames.set(sessionId, game);
    }
    return game;
  }

  async function formalPhase(accountId) {
    return formalGame.store.transact((world) => {
      if (Object.values(world.characters).some((character) => character.ownerAccountId === accountId)) return 'active';
      if (world.pendingLives?.[accountId]) return 'pending';
      return 'none';
    });
  }

  async function handleAction({ sessionId, body }) {
    if (!body.action || typeof body.action.type !== 'string') {
      throw Object.assign(new Error('invalid action'), { statusCode: 400 });
    }
    const accountId = onboardingAccountId(sessionId);
    const phase = await formalPhase(accountId);

    if (body.action.type === 'onboarding.leave-tutorial') {
      if (body.action.payload?.confirmDiscard !== true) return { ok: false, code: 'TUTORIAL_EXIT_CONFIRMATION_REQUIRED' };
      if (phase === 'active') return { ok: false, code: 'ACTIVE_LIFE_EXISTS' };
      if (phase === 'none') {
        const tutorialGame = tutorialGameFor(sessionId);
        if (!tutorialGame.store.snapshot().characters[sessionId]) return { ok: false, code: 'TUTORIAL_AVATAR_REQUIRED' };
      }
      const actor = createDeveloperTestSession({
        environment: LOCAL_ONBOARDING_ENVIRONMENT,
        accountId,
        sessionId,
      }).actor;
      const pending = await formalGame.runtime.dispatch({
        actor,
        requestId: body.requestId,
        action: { type: 'life.create-pending', payload: {} },
      });
      if (!pending.ok) return pending;
      tutorialGames.delete(sessionId);
      return { ok: true, code: 'TUTORIAL_LEFT', data: { pendingLife: pending.data?.pendingLife } };
    }

    if (phase === 'pending' && body.action.type === 'narrative.scene') {
      return { ok: false, code: 'FORMAL_BIRTH_PENDING' };
    }

    if (phase === 'none') {
      const tutorialGame = tutorialGameFor(sessionId);
      const actor = createDeveloperTestSession({
        environment: LOCAL_TUTORIAL_ENVIRONMENT,
        accountId,
        sessionId,
      }).actor;
      const result = await tutorialGame.runtime.dispatch({ actor, requestId: body.requestId, action: body.action });
      if (result.ok && body.action.type === 'narrative.scene') {
        return { ...result, data: { ...result.data, onboarding: { phase: 'tutorial' } } };
      }
      return result;
    }

    const actor = createDeveloperTestSession({
      environment: LOCAL_ONBOARDING_ENVIRONMENT,
      accountId,
      sessionId,
    }).actor;
    const result = await formalGame.runtime.dispatch({ actor, requestId: body.requestId, action: body.action });
    if (result.ok && body.action.type === 'narrative.scene') {
      return { ...result, data: { ...result.data, onboarding: { phase: 'formal' } } };
    }
    return result;
  }

  return createDevServer({
    entryFile: 'onboarding.html',
    runtimeEnvironment: LOCAL_ONBOARDING_ENVIRONMENT,
    actionHandler: handleAction,
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const useFirstSettlement = process.argv.includes('--first-settlement');
  const useTutorial = process.argv.includes('--tutorial');
  const useOnboarding = process.argv.includes('--onboarding');
  if ([useFirstSettlement, useTutorial, useOnboarding].filter(Boolean).length > 1) throw new Error('choose one dev server mode');
  const server = useOnboarding
    ? createOnboardingDevServer()
    : useTutorial
      ? createTutorialDevServer()
      : useFirstSettlement
        ? createDevServer({
          contentPack: firstSettlementPack,
          filePath: join(here, '..', '.data', 'first-settlement-world.json'),
        })
        : createDevServer();
  const port = Number(process.env.PORT ?? 8787);
  server.listen(port, '127.0.0.1', () => {
    const mode = useOnboarding ? ' onboarding' : useTutorial ? ' tutorial' : useFirstSettlement ? ' first-settlement' : '';
    console.log(`ImmortalVoyage V2${mode} local dev server: http://127.0.0.1:${port}`);
  });
}
