export const RUNTIME_STAGE = Object.freeze({
  DEVELOPMENT_TEST: 'development-test',
  CLOSED_BETA_WIPE: 'closed-beta-wipe',
  CLOSED_BETA_PERSISTENT: 'closed-beta-persistent',
  PRODUCTION: 'production',
});

const STAGE_POLICY = Object.freeze({
  [RUNTIME_STAGE.DEVELOPMENT_TEST]: Object.freeze({
    disposableGameplay: true,
    resetAllowed: true,
    developerTestIdentityAllowed: true,
    durableGameplay: false,
  }),
  [RUNTIME_STAGE.CLOSED_BETA_WIPE]: Object.freeze({
    disposableGameplay: true,
    resetAllowed: true,
    developerTestIdentityAllowed: false,
    durableGameplay: false,
  }),
  [RUNTIME_STAGE.CLOSED_BETA_PERSISTENT]: Object.freeze({
    disposableGameplay: false,
    resetAllowed: false,
    developerTestIdentityAllowed: false,
    durableGameplay: true,
  }),
  [RUNTIME_STAGE.PRODUCTION]: Object.freeze({
    disposableGameplay: false,
    resetAllowed: false,
    developerTestIdentityAllowed: false,
    durableGameplay: true,
  }),
});

function assertNonEmptyText(value, label) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128 || value.trim() !== value) {
    throw new TypeError(`${label} must be bounded non-empty text`);
  }
}

export function createRuntimeEnvironment({ stage, worldNamespace }) {
  const policy = STAGE_POLICY[stage];
  if (!policy) throw new Error('unsupported runtime stage');
  assertNonEmptyText(worldNamespace, 'worldNamespace');
  return Object.freeze({ stage, worldNamespace, ...policy });
}

export function assertWorldNamespace(world, environment) {
  if (!environment?.worldNamespace || world?.worldId !== environment.worldNamespace) {
    throw new Error('world namespace does not match runtime environment');
  }
  return world;
}

export function assertResetAllowed(environment) {
  if (!environment?.resetAllowed || !environment.disposableGameplay) {
    throw new Error('gameplay reset is forbidden in this runtime stage');
  }
  return environment;
}

export function assertDeveloperTestIdentityAllowed(environment) {
  if (!environment?.developerTestIdentityAllowed || environment.stage !== RUNTIME_STAGE.DEVELOPMENT_TEST) {
    throw new Error('developer test identity is forbidden in this runtime stage');
  }
  return environment;
}

export const LOCAL_DEVELOPMENT_ENVIRONMENT = createRuntimeEnvironment({
  stage: RUNTIME_STAGE.DEVELOPMENT_TEST,
  worldNamespace: 'v2-dev-world',
});

export const LOCAL_TUTORIAL_ENVIRONMENT = createRuntimeEnvironment({
  stage: RUNTIME_STAGE.DEVELOPMENT_TEST,
  worldNamespace: 'v2-tutorial-world',
});

export const LOCAL_ONBOARDING_ENVIRONMENT = createRuntimeEnvironment({
  stage: RUNTIME_STAGE.DEVELOPMENT_TEST,
  worldNamespace: 'v2-onboarding-world',
});
