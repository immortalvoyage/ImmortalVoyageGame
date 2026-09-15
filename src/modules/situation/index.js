import { validateGameModuleManifest } from '../../core/module-manifest.js';
import { getOwnedActiveCharacter } from '../../core/permission-boundary.js';
import { isNpcAvailableAt } from '../npc/availability.js';
import { buildKnownPurposeTargets } from '../purpose/known-targets.js';
import { jobRequirementsMet } from '../progression/requirements.js';
import { buildPublicSurvivalCondition } from '../survival/condition.js';

export const MAX_SITUATION_OPPORTUNITIES = 4;

const manifest = validateGameModuleManifest({
  name: 'situation',
  dataVersion: 8,
  actions: ['situation.observe'],
});

function option(label, type, payload = {}) {
  return { label, intent: { type, payload } };
}

function visibleNpcsAt(character, contentPack, logicalTimeSeconds) {
  return Object.entries(contentPack.npcs)
    .filter(([, npc]) => npc.locationId === character.locationId && isNpcAvailableAt(npc, logicalTimeSeconds))
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

function normalOpportunityOrder({ social, purpose, employment }) {
  const primary = [purpose[0], social[0], employment[0]].filter(Boolean);
  return [
    ...primary,
    ...purpose.slice(1),
    ...employment.slice(1),
    ...social.slice(1),
  ];
}

export function buildSituationOpportunities({ character, contentPack, isActionAvailable, logicalTimeSeconds = 0 }) {
  if (!character || !contentPack || typeof isActionAvailable !== 'function') return [];
  const location = contentPack.locations[character.locationId];
  if (!location) return [];

  const visibleNpcs = visibleNpcsAt(character, contentPack, logicalTimeSeconds);
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
      .filter((job) => visibleNpcIds.has(job.employerNpcId) && jobRequirementsMet(character, job))
      .map((job) => {
        const employer = contentPack.npcs[job.employerNpcId];
        return option(`接受${employer.name}的${job.title}工作（每次報酬 ${job.rewardMoney}）`, 'employment.accept', { jobId: job.id });
      })
    : [];



  // Situation owns bounded social/purpose/contract choices only. Travel is projected separately so routes cannot be crowded out.
  const ordered = survivalCondition?.severity === 'critical'
    ? [...social, ...purpose, ...employment]
    : normalOpportunityOrder({ social, purpose, employment });

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
      logicalTimeSeconds: world.logicalTimeSeconds,
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
