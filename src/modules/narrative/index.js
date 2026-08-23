import { validateGameModuleManifest } from '../../core/module-manifest.js';
import { buildLocationView } from '../location/index.js';

const manifest = validateGameModuleManifest({ name: 'narrative', dataVersion: 1, actions: ['narrative.scene'] });

function scene({ world, actor, context }) {
  const view = buildLocationView(world, actor);
  if (!view) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  const options = buildOptions(view, context?.isActionAvailable ?? (() => true));
  return {
    ok: true,
    code: 'SCENE_PRESENTED',
    data: {
      ...view,
      narrative: {
        mode: 'deterministic-fallback',
        text: sceneText(view),
        options,
      },
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
  const locationId = view.character.locationId;
  if (locationId === 'starter-square') {
    const foreman = view.visibleNpcs.find((npc) => npc.id === 'foreman');
    if (foreman) options.push(option('和雜役領班談談', 'npc.interact', { npcId: foreman.id }));
    options.push(option('找一份雜役工作', 'economy.work'));
    for (const route of view.routes.slice(0, 2)) options.push(option(`前往${route.name}`, 'location.travel', { destinationId: route.id }));
  } else if (locationId === 'starter-well') {
    options.push(option('在水井取水', 'survival.gather', { kind: 'water' }));
    const back = view.routes[0];
    if (back) options.push(option(`返回${back.name}`, 'location.travel', { destinationId: back.id }));
    if ((view.character.inventory.water ?? 0) > 0) options.push(option('喝一些水', 'survival.consume', { kind: 'water' }));
  } else if (locationId === 'starter-grove') {
    options.push(option('採集可食用的東西', 'survival.gather', { kind: 'food' }));
    const back = view.routes[0];
    if (back) options.push(option(`返回${back.name}`, 'location.travel', { destinationId: back.id }));
    if ((view.character.inventory.food ?? 0) > 0) options.push(option('吃掉手邊的食物', 'survival.consume', { kind: 'food' }));
  }
  return options.filter((choice) => isActionAvailable(choice.intent.type)).slice(0, 4);
}

function option(label, type, payload = {}) {
  return { label, intent: { type, payload } };
}

export const narrativeModule = { manifest, actions: { 'narrative.scene': scene } };
