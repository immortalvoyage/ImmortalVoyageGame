import { validateGameModuleManifest } from '../../core/module-manifest.js';
import { getOwnedActiveCharacter } from '../../core/permission-boundary.js';
import { hasEmploymentForJob } from '../employment/index.js';
import { canApplyInventoryDelta } from '../inventory/index.js';
import { formatTravelDuration } from '../location/index.js';
import { buildKnownPurposeTargets } from '../purpose/known-targets.js';
import { buildPublicSurvivalCondition } from '../survival/condition.js';

export const MAX_SITUATION_OPPORTUNITIES = 4;

const manifest = validateGameModuleManifest({
  name: 'situation',
  dataVersion: 4,
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

function normalOpportunityOrder({ social, purpose, employment, work, gather, travel }) {
  const livelihood = work[0] ?? employment[0] ?? gather[0] ?? null;
  const primary = [purpose[0], social[0], livelihood, travel[0]].filter(Boolean);

  const employmentRemainder = livelihood === employment[0] ? employment.slice(1) : employment;
  const workRemainder = livelihood === work[0] ? work.slice(1) : work;
  const gatherRemainder = livelihood === gather[0] ? gather.slice(1) : gather;
  return [
    ...primary,
    ...purpose.slice(1),
    ...employmentRemainder,
    ...workRemainder,
    ...gatherRemainder,
    ...social.slice(1),
    ...travel.slice(1),
  ];
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
  const employmentActive = isActionAvailable('employment.observe') && isActionAvailable('employment.accept');

  const social = visibleNpcs
    .filter(() => isActionAvailable('npc.interact'))
    .map((npc) => option(`和${npc.name}談談`, 'npc.interact', { npcId: npc.id }));

  const purpose = isActionAvailable('purpose.find-npc')
    ? buildKnownPurposeTargets(character, contentPack, { knowledgeActive })
      .filter((target) => !visibleNpcIds.has(target.id))
      .map((target) => option(target.searchLabel, 'purpose.find-npc', { npcId: target.id }))
    : [];

  const employment = employmentActive && !character.currentEmployment
    ? (location.jobs ?? [])
      .filter((job) => visibleNpcIds.has(job.employerNpcId))
      .map((job) => {
        const employer = contentPack.npcs[job.employerNpcId];
        return option(`接受${employer.name}的${job.title}工作（每次報酬 ${job.rewardMoney}）`, 'employment.accept', { jobId: job.id });
      })
    : [];

  const work = survivalCondition?.severity === 'critical' || !isActionAvailable('economy.work')
    ? []
    : (location.jobs ?? [])
      .filter((job) => !employmentActive || hasEmploymentForJob(character, job, character.locationId))
      .map((job) => option(job.label, 'economy.work', { jobId: job.id }));

  const gather = isActionAvailable('survival.gather')
    ? (location.gatherables ?? [])
      .filter((entry) => canApplyInventoryDelta(character.inventory, contentPack.items, contentPack.inventory.carryCapacityUnits, { [entry.itemId]: entry.quantity }))
      .map((entry) => option(entry.label, 'survival.gather', { itemId: entry.itemId }))
    : [];

  const travel = isActionAvailable('location.travel')
    ? (location.routes ?? []).map((route) => {
      const destination = contentPack.locations[route.destinationId];
      return destination
        ? option(`前往${destination.name}（約${formatTravelDuration(route.travelSeconds)}）`, 'location.travel', { destinationId: route.destinationId })
        : null;
    }).filter(Boolean)
    : [];

  // Critical pressure keeps immediate recovery/exits ahead of optional social, purpose, or job-contract content.
  // Normal flow reserves category diversity so a crowded location cannot crowd out livelihood or an exit.
  const ordered = survivalCondition?.severity === 'critical'
    ? [...gather, ...travel, ...social, ...purpose, ...employment]
    : normalOpportunityOrder({ social, purpose, employment, work, gather, travel });

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
