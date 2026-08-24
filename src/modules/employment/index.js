import { validateGameModuleManifest } from '../../core/module-manifest.js';
import { getOwnedActiveCharacter } from '../../core/permission-boundary.js';

const manifest = validateGameModuleManifest({
  name: 'employment',
  dataVersion: 1,
  actions: ['employment.accept', 'employment.resign', 'employment.observe'],
});

function localJob(character, contentPack, jobId) {
  const location = contentPack.locations[character.locationId];
  const job = location?.jobs?.find((entry) => entry.id === jobId) ?? null;
  if (!job) return null;
  const employer = contentPack.npcs[job.employerNpcId];
  if (!employer || employer.locationId !== character.locationId) return null;
  return { location, job, employer };
}

function employmentParts(character, contentPack) {
  const current = character.currentEmployment;
  if (!current) return null;
  const location = contentPack.locations[current.workLocationId];
  const job = location?.jobs?.find((entry) => entry.id === current.jobId) ?? null;
  const employer = contentPack.npcs[current.employerNpcId];
  if (!location || !job || !employer || job.employerNpcId !== current.employerNpcId) return null;
  return { location, job, employer };
}

export function hasEmploymentForJob(character, job, workLocationId) {
  const current = character?.currentEmployment;
  return Boolean(current
    && current.jobId === job?.id
    && current.employerNpcId === job?.employerNpcId
    && current.workLocationId === workLocationId);
}

export function buildPublicEmployment(character, contentPack) {
  const resolved = employmentParts(character, contentPack);
  if (!resolved) return null;
  const { location, job, employer } = resolved;
  return {
    job: { title: job.title, workLabel: job.label },
    employer: { id: currentEmployerId(character), name: employer.name },
    workplace: { id: character.currentEmployment.workLocationId, name: location.name },
    wagePerWork: job.rewardMoney,
  };
}

function currentEmployerId(character) {
  return character.currentEmployment?.employerNpcId ?? null;
}

export function buildEmploymentViewForActor(world, actor, contentPack) {
  const character = getOwnedActiveCharacter(world, actor);
  if (!character) return null;
  return { current: buildPublicEmployment(character, contentPack) };
}

function accept({ world, actor, action, context }) {
  const character = getOwnedActiveCharacter(world, actor);
  if (!character) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  if (character.currentEmployment) return { ok: false, code: 'EMPLOYMENT_ALREADY_ACTIVE' };

  const resolved = localJob(character, context.contentPack, action.payload?.jobId);
  if (!resolved) return { ok: false, code: 'EMPLOYMENT_OFFER_NOT_AVAILABLE' };
  const { job, employer } = resolved;

  character.currentEmployment = {
    jobId: job.id,
    employerNpcId: job.employerNpcId,
    workLocationId: character.locationId,
  };
  const current = buildPublicEmployment(character, context.contentPack);

  return {
    ok: true,
    code: 'EMPLOYMENT_STARTED',
    data: { employment: current },
    events: [{
      type: 'employment.started',
      data: {
        characterId: character.id,
        jobId: job.id,
        employerNpcId: employer === context.contentPack.npcs[job.employerNpcId] ? job.employerNpcId : job.employerNpcId,
        workLocationId: character.locationId,
      },
    }],
  };
}

function resign({ world, actor, context }) {
  const character = getOwnedActiveCharacter(world, actor);
  if (!character) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  if (!character.currentEmployment) return { ok: false, code: 'EMPLOYMENT_NOT_ACTIVE' };

  const previous = structuredClone(character.currentEmployment);
  const publicPrevious = buildPublicEmployment(character, context.contentPack);
  character.currentEmployment = null;

  return {
    ok: true,
    code: 'EMPLOYMENT_ENDED',
    data: { employment: publicPrevious },
    events: [{
      type: 'employment.ended',
      data: {
        characterId: character.id,
        jobId: previous.jobId,
        employerNpcId: previous.employerNpcId,
        workLocationId: previous.workLocationId,
        reason: 'resigned',
      },
    }],
  };
}

function observe({ world, actor, context }) {
  const view = buildEmploymentViewForActor(world, actor, context.contentPack);
  if (!view) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  return { ok: true, code: 'EMPLOYMENT_PRESENTED', data: view };
}

export const employmentModule = {
  manifest,
  actions: {
    'employment.accept': accept,
    'employment.resign': resign,
    'employment.observe': observe,
  },
};
