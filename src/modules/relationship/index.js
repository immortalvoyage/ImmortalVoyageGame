import { validateGameModuleManifest } from '../../core/module-manifest.js';
import { getOwnedActiveCharacter } from '../../core/permission-boundary.js';

const manifest = validateGameModuleManifest({ name: 'relationship', dataVersion: 1, actions: ['relationship.observe'] });

function highestFamiliarity(character, npc) {
  const behaviorId = npc.relationship?.behaviorId;
  const levels = npc.relationship?.levels;
  if (!behaviorId || !Array.isArray(levels)) return null;
  const count = character.behaviorCounts?.[behaviorId] ?? 0;
  if (!Number.isSafeInteger(count) || count < 1) return null;

  let highest = null;
  for (const level of levels) {
    if (count < level.minCount) break;
    highest = level;
  }
  return highest ? { name: highest.name } : null;
}

export function buildRelationshipView(character, npcs = {}) {
  const relationships = [];
  if (!character?.behaviorCounts || !npcs || typeof npcs !== 'object') return relationships;

  for (const [npcId, npc] of Object.entries(npcs)) {
    const familiarity = highestFamiliarity(character, npc);
    if (!familiarity) continue;
    relationships.push({
      npc: { id: npcId, name: npc.name },
      familiarity,
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
