import { validateGameModuleManifest } from '../../core/module-manifest.js';
import { getOwnedActiveCharacter } from '../../core/permission-boundary.js';
import { devStarterPack } from '../../content/dev-starter.js';

const manifest = validateGameModuleManifest({ name: 'career', dataVersion: 1, actions: ['career.observe'] });

export function buildCareerView(character, careers = devStarterPack.careers) {
  if (!character?.behaviorCounts || !careers) return [];
  return Object.values(careers)
    .filter((career) => career.requirements.every(
      (requirement) => (character.behaviorCounts[requirement.behaviorId] ?? 0) >= requirement.minCount,
    ))
    .map((career) => ({ name: career.name }));
}

function observe({ world, actor }) {
  const character = getOwnedActiveCharacter(world, actor);
  if (!character) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  return {
    ok: true,
    code: 'CAREER_OBSERVED',
    data: { careers: buildCareerView(character) },
  };
}

export const careerModule = { manifest, actions: { 'career.observe': observe } };
