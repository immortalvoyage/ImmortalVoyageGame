import { validateGameModuleManifest } from '../../core/module-manifest.js';
import { getOwnedActiveCharacter } from '../../core/permission-boundary.js';
import { findHighestFamiliarityLevel } from './familiarity.js';

const manifest = validateGameModuleManifest({ name: 'relationship', dataVersion: 2, actions: ['relationship.observe'] });

export function buildRelationshipView(character, npcs = {}) {
  const relationships = [];
  if (!character?.behaviorCounts || !npcs || typeof npcs !== 'object') return relationships;

  for (const [npcId, npc] of Object.entries(npcs)) {
    const level = findHighestFamiliarityLevel(character, npc);
    if (!level) continue;
    relationships.push({
      npc: { id: npcId, name: npc.name },
      familiarity: { name: level.name },
    });
  }
  return relationships;
}

export function buildRelationshipViewForActor(world, actor, npcs = {}) {
  const character = getOwnedActiveCharacter(world, actor);
  return character ? buildRelationshipView(character, npcs) : null;
}

function observe({ world, actor, context }) {
  const relationships = buildRelationshipViewForActor(world, actor, context.contentPack.npcs);
  if (!relationships) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  return { ok: true, code: 'RELATIONSHIPS_OBSERVED', data: { relationships } };
}

export const relationshipModule = { manifest, actions: { 'relationship.observe': observe } };
