import { validateGameModuleManifest } from '../../core/module-manifest.js';
import { getOwnedActiveCharacter } from '../../core/permission-boundary.js';
import { behaviorRequirementsMet } from '../progression/requirements.js';

const manifest = validateGameModuleManifest({ name: 'career', dataVersion: 1, actions: ['career.observe'], untrackedActions: ['career.observe'] });

export function buildCareerView(character, careers = {}) {
  if (!character?.behaviorCounts || !careers) return [];
  return Object.values(careers)
    .filter((career) => behaviorRequirementsMet(character, career.requirements))
    .map((career) => ({ name: career.name }));
}

export function buildCareerViewForActor(world, actor, careers = {}) {
  const character = getOwnedActiveCharacter(world, actor);
  return character ? buildCareerView(character, careers) : null;
}

function observe({ world, actor, context }) {
  const careers = buildCareerViewForActor(world, actor, context.contentPack.careers);
  if (!careers) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  return { ok: true, code: 'CAREER_OBSERVED', data: { careers } };
}

export const careerModule = { manifest, actions: { 'career.observe': observe } };
