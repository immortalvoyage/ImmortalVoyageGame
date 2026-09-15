import { validateGameModuleManifest } from '../../core/module-manifest.js';
import { getOwnedActiveCharacter } from '../../core/permission-boundary.js';
import { behaviorRequirementsMet } from './requirements.js';

const manifest = validateGameModuleManifest({ name: 'progression', dataVersion: 1, actions: ['progression.observe'] });

export function buildProgressionView(character, progressionTags = {}) {
  const result = { skills: [], socialTags: [] };
  if (!character?.behaviorCounts || !progressionTags) return result;

  for (const tag of Object.values(progressionTags)) {
    if (!behaviorRequirementsMet(character, tag.requirements)) continue;
    const publicTag = { name: tag.name };
    if (tag.kind === 'skill') result.skills.push(publicTag);
    if (tag.kind === 'social') result.socialTags.push(publicTag);
  }
  return result;
}

export function buildProgressionViewForActor(world, actor, progressionTags = {}) {
  const character = getOwnedActiveCharacter(world, actor);
  return character ? buildProgressionView(character, progressionTags) : null;
}

function observe({ world, actor, context }) {
  const progression = buildProgressionViewForActor(world, actor, context.contentPack.progressionTags);
  if (!progression) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  return { ok: true, code: 'PROGRESSION_OBSERVED', data: progression };
}

export const progressionModule = { manifest, actions: { 'progression.observe': observe } };
