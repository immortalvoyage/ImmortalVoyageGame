import { validateGameModuleManifest } from '../../core/module-manifest.js';
import { devStarterPack } from '../../content/dev-starter.js';
import { buildLocationView } from '../location/index.js';

const manifest = validateGameModuleManifest({ name: 'narrative', dataVersion: 2, actions: ['narrative.scene'] });

function scene({ world, actor, context }) {
  const view = buildLocationView(world, actor);
  if (!view) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  const isActionAvailable = context?.isActionAvailable ?? (() => true);
  return {
    ok: true,
    code: 'SCENE_PRESENTED',
    data: {
      ...view,
      narrative: {
        mode: 'deterministic-fallback',
        text: sceneText(view),
        options: buildOptions(view, isActionAvailable),
      },
      utilities: buildUtilities(view, isActionAvailable),
    },
  };
}

function sceneText(view) {
  const { location, character } = view;
  if (character.needs.thirst >= 60) return `${location.description} 你明顯感到口渴，下一步最好先處理飲水。`;
  if (character.needs.hunger >= 60) return `${location.description} 飢餓感正在變得難以忽視。`;
  return location.description;
}

function buildOptions(view, isActionAvailable) {
  const options = [];
  const location = devStarterPack.locations[view.character.locationId];
  for (const npc of view.visibleNpcs) options.push(option(`和${npc.name}談談`, 'npc.interact', { npcId: npc.id }));
  for (const job of location.jobs ?? []) options.push(option(job.label, 'economy.work', { jobId: job.id }));
  for (const gatherable of location.gatherables ?? []) options.push(option(gatherable.label, 'survival.gather', { itemId: gatherable.itemId }));
  for (const route of view.routes) options.push(option(`前往${route.name}`, 'location.travel', { destinationId: route.id }));
  return options.filter((choice) => isActionAvailable(choice.intent.type)).slice(0, 4);
}

function buildUtilities(view, isActionAvailable) {
  const utilities = [];
  const location = devStarterPack.locations[view.character.locationId];
  if (isActionAvailable('survival.consume')) {
    for (const [itemId, quantity] of Object.entries(view.character.inventory)) {
      const item = devStarterPack.items[itemId];
      if (quantity > 0 && item?.consumeEffect) utilities.push(option(item.consumeLabel ?? `使用${item.name}`, 'survival.consume', { itemId }));
    }
  }
  if (isActionAvailable('economy.buy')) {
    for (const offer of location.market ?? []) {
      const item = devStarterPack.items[offer.itemId];
      if (item) utilities.push(option(`購買${item.name}（${offer.price}）`, 'economy.buy', { itemId: offer.itemId }));
    }
  }
  return utilities;
}

function option(label, type, payload = {}) {
  return { label, intent: { type, payload } };
}

export const narrativeModule = { manifest, actions: { 'narrative.scene': scene } };
