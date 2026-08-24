import { MAX_CHARACTER_KNOWLEDGE } from '../../core/world-state.js';
import { validateGameModuleManifest } from '../../core/module-manifest.js';
import { getOwnedActiveCharacter } from '../../core/permission-boundary.js';

const manifest = validateGameModuleManifest({ name: 'knowledge', dataVersion: 1, actions: ['knowledge.observe'] });

function validKnowledgeId(value) {
  return typeof value === 'string' && value.length > 0;
}

export function grantKnowledge(character, knowledgeIds = []) {
  if (!character || !Array.isArray(character.knowledgeIds) || !Array.isArray(knowledgeIds)) {
    return { ok: false, code: 'INVALID_KNOWLEDGE_STATE', learnedIds: [] };
  }

  const existing = new Set();
  for (const knowledgeId of character.knowledgeIds) {
    if (!validKnowledgeId(knowledgeId) || existing.has(knowledgeId)) {
      return { ok: false, code: 'INVALID_KNOWLEDGE_STATE', learnedIds: [] };
    }
    existing.add(knowledgeId);
  }

  const learnedIds = [];
  for (const knowledgeId of knowledgeIds) {
    if (!validKnowledgeId(knowledgeId)) return { ok: false, code: 'INVALID_KNOWLEDGE_GRANT', learnedIds: [] };
    if (existing.has(knowledgeId)) continue;
    existing.add(knowledgeId);
    learnedIds.push(knowledgeId);
  }

  if (character.knowledgeIds.length + learnedIds.length > MAX_CHARACTER_KNOWLEDGE) {
    return { ok: false, code: 'KNOWLEDGE_LIMIT_REACHED', learnedIds: [] };
  }

  character.knowledgeIds.push(...learnedIds);
  return { ok: true, learnedIds };
}

export function characterHasKnowledge(character, knowledgeId) {
  return validKnowledgeId(knowledgeId)
    && Array.isArray(character?.knowledgeIds)
    && character.knowledgeIds.includes(knowledgeId);
}

export function characterKnowsNpcThroughKnowledge(character, npcId, knowledgeCatalog) {
  if (!Array.isArray(character?.knowledgeIds) || typeof npcId !== 'string' || !npcId) return false;
  for (const knowledgeId of character.knowledgeIds) {
    const fact = knowledgeCatalog?.[knowledgeId];
    if ((fact?.revealsNpcIds ?? []).includes(npcId)) return true;
  }
  return false;
}

export function buildKnowledgeView(character, knowledgeCatalog) {
  if (!Array.isArray(character?.knowledgeIds)) return [];
  return character.knowledgeIds.flatMap((knowledgeId) => {
    const fact = knowledgeCatalog?.[knowledgeId];
    return fact?.name ? [{ name: fact.name }] : [];
  });
}

export function buildKnowledgeViewForActor(world, actor, knowledgeCatalog) {
  const character = getOwnedActiveCharacter(world, actor);
  return character ? buildKnowledgeView(character, knowledgeCatalog) : null;
}

function observe({ world, actor, context }) {
  const knowledge = buildKnowledgeViewForActor(world, actor, context.contentPack.knowledge);
  if (!knowledge) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  return { ok: true, code: 'KNOWLEDGE_PRESENTED', data: { knowledge } };
}

export const knowledgeModule = { manifest, actions: { 'knowledge.observe': observe } };
