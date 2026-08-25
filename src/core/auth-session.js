import { assertDeveloperTestIdentityAllowed } from './runtime-environment.js';

function assertIdentityPart(value, label) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128 || value.trim() !== value) {
    throw new TypeError(`${label} must be bounded non-empty text`);
  }
}

export function createDeveloperTestSession({ environment, accountId, sessionId }) {
  assertDeveloperTestIdentityAllowed(environment);
  assertIdentityPart(accountId, 'accountId');
  assertIdentityPart(sessionId, 'sessionId');

  const identity = Object.freeze({
    accountId,
    authProvider: 'developer-test',
  });
  const session = Object.freeze({
    sessionId,
    accountId,
    authProvider: identity.authProvider,
  });
  const actor = Object.freeze({ sessionId });

  return Object.freeze({ identity, session, actor });
}
