import { validateGameModuleManifest } from '../../core/module-manifest.js';
import { getOwnedActiveCharacter } from '../../core/permission-boundary.js';
import { buildKnownPurposeTargets } from '../purpose/known-targets.js';
import { buildPublicSurvivalCondition } from '../survival/condition.js';

export const MAX_SITUATION_OPPORTUNITIES = 4;

const manifest = validateGameModuleManifest({
  name: 'situation',
  dataVersion: 1,
  actions: ['situation.observe'],
});

function option(label, type, payload = {}) {
  return { label, intent: { type, payload } };
}

function visibleNpcsAt(character, contentPack) {
  return Object.entries(contentPack.npcs)
    .filter(([, npc]) => npc.locationId === character.locationId)
    .map(([id, npc]) => ({ id, name: npc.name }));
}

function dedupeAndLimit(opportunities) {
  const result = [];
  const seen = new Set();
  for (const opportunity of opportunities) {
    const key = `${opportunity.intent.type}:${JSON.stringify(opportunity.intent.payload ?? {})}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(opportunity);
    if (result.length >= MAX_SITUATION_OPPORTUNITIES) break;
  }
  return result;
}

export function buildSituationOpportunities({ character, contentPack, isActionAvailable }) {
  if (!character || !contentPack || typeof isActionAvailable !== 'function') return [];
  const location = contentPack.locations[character.locationId];
  if (!location) return [];

  const visibleNpcs = visibleNpcsAt(character, contentPack);
  const visibleNpcIds = new Set(visibleNpcs.map((npc) => npc.id));
  const survivalActive = isActionAvailable('survival.gather')
    || isActionAvailable('survival.consume')
    || isActionAvailable('survival.rest');
  const survivalCondition = survivalActive
    ? buildPublicSurvivalCondition(character, contentPack.survival)
    : null;
  const knowledgeActive = isActionAvailable('knowledge.observe');

  const social = visibleNpcs
    .filter(() => isActionAvailable('npc.interact'))
    .map((npc) => option(`和${npc.name}談談`, 'npc.interact', { npcId: npc.id }));

  const purpose = isActionAvailable('purpose.find-npc')
    ? buildKnownPurposeTargets(character, contentPack, { knowledgeActive })
      .filter((target) => !visibleNpcIds.has(target.id))
      .map((target) => option(target.searchLabel, 'purpose.find-npc', { npcId: target.id }))
    : [];

  const work = survivalCondition?.severity === 'critical' || !isActionAvailable('economy.work')
    ? []
    : (location.jobs ?? []).map((job) => option(job.label, 'economy.work', { jobId: job.id }));

  const gather = isActionAvailable('survival.gather')
    ? (location.gatherables ?? []).map((entry) => option(entry.label, 'survival.gather', { itemId: entry.itemId }))
    : [];

  const travel = isActionAvailable('location.travel')
    ? (location.routes ?? []).map((destinationId) => {
      const destination = contentPack.locations[destinationId];
      return destination ? option(`前往${destination.name}`, 'location.travel', { destinationId }) : null;
    }).filter(Boolean)
    : [];

  // Under critical survival pressure, keep immediate recovery/exits ahead of optional social/work content.
  // Otherwise preserve the familiar social → purpose → work → gather → travel reading flow.
  const ordered = survivalCondition?.severity === 'critical'
    ? [...gather, ...travel, ...social, ...purpose]
    : [...social, ...purpose, ...work, ...gather, ...travel];

  return dedupeAndLimit(ordered);
}

export function buildSituationViewForActor(world, actor, context) {
  const character = getOwnedActiveCharacter(world, actor);
  if (!character) return null;
  return {
    opportunities: buildSituationOpportunities({
      character,
      contentPack: context.contentPack,
      isActionAvailable: context.isActionAvailable,
    }),
  };
}

function observe({ world, actor, context }) {
  const situation = buildSituationViewForActor(world, actor, context);
  if (!situation) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  return { ok: true, code: 'SITUATION_PRESENTED', data: situation };
}

export const situationModule = {
  manifest,
  actions: { 'situation.observe': observe },
};
