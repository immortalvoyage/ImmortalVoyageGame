import { getOwnedActiveCharacter } from '../../core/permission-boundary.js';
import { validateGameModuleManifest } from '../../core/module-manifest.js';
import { buildCareerViewForActor } from '../career/index.js';
import { buildPublicInventory } from '../inventory/index.js';
import { buildKnowledgeViewForActor } from '../knowledge/index.js';
import { buildLocationView } from '../location/index.js';
import { buildProgressionViewForActor } from '../progression/index.js';
import { buildKnownPurposeTargets } from '../purpose/known-targets.js';
import { buildRelationshipViewForActor } from '../relationship/index.js';
import { findUnlockedFamiliarityTopics } from '../relationship/familiarity.js';
import { buildPublicSurvivalCondition } from '../survival/condition.js';
import { buildTradeViewForActor } from '../trade/index.js';

const manifest = validateGameModuleManifest({ name: 'narrative', dataVersion: 14, actions: ['narrative.scene'] });

function scene({ world, actor, context }) {
  const contentPack = context.contentPack;
  const character = getOwnedActiveCharacter(world, actor);
  if (!character) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  const view = buildLocationView(world, actor, contentPack);
  if (!view) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  const isActionAvailable = context?.isActionAvailable ?? (() => true);
  const careers = isActionAvailable('career.observe')
    ? buildCareerViewForActor(world, actor, contentPack.careers) ?? []
    : [];
  const progression = isActionAvailable('progression.observe')
    ? buildProgressionViewForActor(world, actor, contentPack.progressionTags)
    : null;
  const relationships = isActionAvailable('relationship.observe')
    ? buildRelationshipViewForActor(world, actor, contentPack.npcs) ?? []
    : null;
  const knowledge = isActionAvailable('knowledge.observe')
    ? buildKnowledgeViewForActor(world, actor, contentPack.knowledge) ?? []
    : null;
  const trade = isActionAvailable('trade.browse')
    ? buildTradeViewForActor(world, actor, contentPack.items)
    : null;
  const survivalActive = isActionAvailable('survival.gather') || isActionAvailable('survival.consume') || isActionAvailable('survival.rest');
  const survivalCondition = survivalActive
    ? buildPublicSurvivalCondition(character, contentPack.survival)
    : null;
  return {
    ok: true,
    code: 'SCENE_PRESENTED',
    data: {
      ...view,
      careers,
      progression,
      relationships,
      knowledge,
      trade,
      survivalCondition,
      inventoryItems: buildPublicInventory(view.character.inventory, contentPack.items),
      narrative: {
        mode: 'deterministic-fallback',
        text: sceneText(view, survivalCondition),
        options: buildOptions(view, character, isActionAvailable, contentPack, survivalCondition),
      },
      utilities: buildUtilities(view, isActionAvailable, contentPack),
    },
  };
}

function needNames(entries = []) {
  return entries.map((entry) => entry.name).join('、');
}

function sceneText(view, survivalCondition) {
  const { location } = view;
  if (survivalCondition?.severity === 'critical') {
    return `${location.description} ${needNames(survivalCondition.criticalNeeds)}已達危急程度，現在應優先補給或休整，不適合繼續工作。`;
  }
  if (survivalCondition?.severity === 'warning') {
    return `${location.description} 你已明顯感到${needNames(survivalCondition.warningNeeds)}，最好在狀況惡化前處理。`;
  }
  return location.description;
}

function buildOptions(view, character, isActionAvailable, contentPack, survivalCondition) {
  const options = [];
  const location = contentPack.locations[character.locationId];
  const visibleNpcIds = new Set(view.visibleNpcs.map((npc) => npc.id));
  const knowledgeActive = isActionAvailable('knowledge.observe');

  for (const npc of view.visibleNpcs) options.push(option(`和${npc.name}談談`, 'npc.interact', { npcId: npc.id }));
  for (const target of buildKnownPurposeTargets(character, contentPack, { knowledgeActive })) {
    if (!visibleNpcIds.has(target.id)) options.push(option(target.searchLabel, 'purpose.find-npc', { npcId: target.id }));
  }
  if (survivalCondition?.severity !== 'critical') {
    for (const job of location.jobs ?? []) options.push(option(job.label, 'economy.work', { jobId: job.id }));
  }
  for (const gatherable of location.gatherables ?? []) options.push(option(gatherable.label, 'survival.gather', { itemId: gatherable.itemId }));
  for (const route of view.routes) options.push(option(`前往${route.name}`, 'location.travel', { destinationId: route.id }));
  return options.filter((choice) => isActionAvailable(choice.intent.type)).slice(0, 4);
}

function buildUtilities(view, isActionAvailable, contentPack) {
  const utilities = [];
  const location = contentPack.locations[view.character.locationId];
  if (isActionAvailable('survival.consume')) {
    for (const [itemId, quantity] of Object.entries(view.character.inventory)) {
      const item = contentPack.items[itemId];
      if (quantity > 0 && item?.consumeEffect) utilities.push(option(item.consumeLabel ?? `使用${item.name}`, 'survival.consume', { itemId }));
    }
  }
  if (isActionAvailable('survival.rest') && view.character.needs.fatigue > 0) {
    utilities.push(option('休息片刻', 'survival.rest'));
  }
  if (isActionAvailable('npc.ask') && isActionAvailable('relationship.observe')) {
    for (const publicNpc of view.visibleNpcs) {
      const npc = contentPack.npcs[publicNpc.id];
      for (const topic of findUnlockedFamiliarityTopics(view.character, npc)) {
        utilities.push(option(`${publicNpc.name}：${topic.label}`, 'npc.ask', { npcId: publicNpc.id, topicId: topic.id }));
      }
    }
  }
  if (isActionAvailable('crafting.craft')) {
    for (const recipe of location.recipes ?? []) {
      const ingredients = recipe.inputs
        .map((input) => `${contentPack.items[input.itemId].name}×${input.quantity}`)
        .join('＋');
      utilities.push(option(`${recipe.label}（${ingredients}）`, 'crafting.craft', { recipeId: recipe.id }));
    }
  }
  if (isActionAvailable('economy.buy')) {
    for (const offer of location.market ?? []) {
      const item = contentPack.items[offer.itemId];
      if (item) utilities.push(option(`購買${item.name}（${offer.price}）`, 'economy.buy', { itemId: offer.itemId }));
    }
  }
  return utilities;
}

function option(label, type, payload = {}) {
  return { label, intent: { type, payload } };
}

export const narrativeModule = { manifest, actions: { 'narrative.scene': scene } };
