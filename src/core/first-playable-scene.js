import { getStarterGatherOption, performStarterGather } from './starter-gather.js';
import { describeItemStack } from '../modules/inventory/item-catalog.js';

const SCENES = Object.freeze({
  coast: Object.freeze({
    title: '潮聲初醒',
    body: '鹹濕的風穿過屋縫，遠處傳來繩索拍擊桅杆的聲音。你知道港口已經醒了，而你也必須決定今天先往哪裡走。',
    choices: Object.freeze([
      Object.freeze({ id: 'observe', label: '先觀察港口', result: '你先沒有急著靠近人群，而是記下碼頭、貨棧與巡邏者的位置。這些情報暫時沒有改變世界，卻讓你對周遭多了一分把握。', progress: Object.freeze({ awareness: 1, locationKnowledge: 1 }) }),
      Object.freeze({ id: 'seek-work', label: '往碼頭找活做', result: '你朝最吵雜的碼頭走去。扛貨、補網、跑腿與臨時船工的招呼聲此起彼落；這裡很可能成為你第一份收入的起點。', progress: Object.freeze({ settlementContact: 1 }) }),
      Object.freeze({ id: 'explore', label: '沿海岸走走', result: '你避開港口中心，沿著潮線往外走。礁石、漂流物與陌生腳印讓你意識到，海邊不只有工作，也藏著許多尚未被注意的痕跡。', progress: Object.freeze({ exploration: 1, locationKnowledge: 1 }) }),
    ]),
    unlock: Object.freeze({ id: 'read-harbor-flow', label: '順著港口脈絡行動', result: '你已不是第一次看這片港口。潮位、貨流與巡邏節奏開始能彼此對上，你避開最擁擠的路線，更快找到真正值得注意的地方。', requires: Object.freeze({ locationKnowledge: 2 }), progress: Object.freeze({ awareness: 1, routeConfidence: 1 }) }),
  }),
  forest: Object.freeze({
    title: '林間初醒',
    body: '晨霧還掛在樹梢，鳥鳴與遠處的斧聲交錯。林子能給人食物，也能藏住危險；你得先決定怎麼度過這一天。',
    choices: Object.freeze([
      Object.freeze({ id: 'observe', label: '先辨認周遭', result: '你花時間觀察水源、獸徑與人走過的痕跡。沒有收穫立刻落進手裡，但你避免了毫無準備地闖進更深的林子。', progress: Object.freeze({ awareness: 1, locationKnowledge: 1 }) }),
      Object.freeze({ id: 'seek-work', label: '循斧聲找人', result: '你循著斧聲前進，很快看見有人整理木料。砍柴、搬運、採集與跑腿，都可能成為你換取第一頓飯的方法。', progress: Object.freeze({ settlementContact: 1 }) }),
      Object.freeze({ id: 'explore', label: '往林中探索', result: '你沿著較少人走的小徑深入。泥土上的足跡和折斷的枝條提醒你：這片林地不是空無一人，也不是完全安全。', progress: Object.freeze({ exploration: 1, locationKnowledge: 1 }) }),
    ]),
    unlock: Object.freeze({ id: 'read-forest-signs', label: '循熟悉的林跡前進', result: '你開始分得出舊獸徑、新腳印與常有人走動的方向。林子仍危險，但你已不再只是靠運氣選路。', requires: Object.freeze({ locationKnowledge: 2 }), progress: Object.freeze({ exploration: 1, routeConfidence: 1 }) }),
  }),
  grassland: Object.freeze({
    title: '風原初醒',
    body: '風吹過大片草浪，遠處炊煙與牲畜的影子若隱若現。這裡看似開闊，真正的道路卻藏在人群、水源與季節之間。',
    choices: Object.freeze([
      Object.freeze({ id: 'observe', label: '登高觀望', result: '你先找了稍高的地勢辨認水源、煙柱與道路。開闊地讓方向更容易確認，也讓自己的位置更容易被別人看見。', progress: Object.freeze({ awareness: 1, locationKnowledge: 1 }) }),
      Object.freeze({ id: 'seek-work', label: '往炊煙方向走', result: '你朝有人煙的方向走去。放牧、修繕、運送與照料牲畜，都是能讓陌生人換到食物與信任的工作。', progress: Object.freeze({ settlementContact: 1 }) }),
      Object.freeze({ id: 'explore', label: '沿水草尋路', result: '你沿著較茂盛的草地前進，希望找到水與人跡。遠處留下的車轍證明，這裡曾有其他旅人經過。', progress: Object.freeze({ exploration: 1, locationKnowledge: 1 }) }),
    ]),
    unlock: Object.freeze({ id: 'read-grassland-route', label: '沿熟悉的水路與車轍走', result: '你已能把水草、車轍與炊煙連成一條較可靠的路。草原依舊遼闊，但方向不再全靠猜測。', requires: Object.freeze({ locationKnowledge: 2 }), progress: Object.freeze({ exploration: 1, routeConfidence: 1 }) }),
  }),
});

const ACTION_HISTORY_LIMIT = 20;

function sceneKey(character) {
  const tags = Array.isArray(character?.birthRegionTags) ? character.birthRegionTags : [];
  if (tags.includes('coast') || tags.includes('island') || tags.includes('urban')) return 'coast';
  if (tags.includes('forest') || tags.includes('mountain')) return 'forest';
  return 'grassland';
}

function requirementsMet(character, requires = {}) {
  const progress = character?.worldProgress && typeof character.worldProgress === 'object' ? character.worldProgress : {};
  return Object.entries(requires).every(([key, amount]) => Number(progress[key] || 0) >= amount);
}

function inventoryItems(character) {
  return Array.isArray(character?.inventory?.items)
    ? character.inventory.items.filter((item) => item && Number(item.quantity) > 0)
    : [];
}

export function describeInventory(character) {
  const items = inventoryItems(character);
  if (!items.length) return '你的行囊目前是空的。';
  const description = items.map((item) => describeItemStack(item.itemId, item.quantity)).join('、');
  return `你打開行囊查看，目前帶著：${description}。`;
}

export function getFirstPlayableScene(character) {
  const key = sceneKey(character);
  const scene = SCENES[key];
  const choices = [...scene.choices];
  const gather = getStarterGatherOption(character);
  if (gather) choices.push(Object.freeze({ id: 'starter-gather', label: gather.label, result: gather.result, progress: Object.freeze({}) }));
  if (inventoryItems(character).length) choices.push(Object.freeze({ id: 'view-inventory', label: '查看行囊', result: describeInventory(character), progress: Object.freeze({}), readOnly: true }));
  if (requirementsMet(character, scene.unlock.requires)) choices.push(scene.unlock);
  return Object.freeze({ id: `birth-${key}`, title: scene.title, body: scene.body, choices: Object.freeze(choices) });
}

export function resolveFirstPlayableAction(character, actionId) {
  const scene = getFirstPlayableScene(character);
  const choice = scene.choices.find((item) => item.id === String(actionId || ''));
  if (!choice) {
    const error = new Error('unsupported first-scene action');
    error.code = 'unsupported_scene_action';
    throw error;
  }
  return Object.freeze({
    sceneId: scene.id,
    actionId: choice.id,
    result: choice.result,
    progress: choice.progress,
    worldMutation: false,
    nextSystem: choice.id === 'seek-work' ? 'starter_work' : null,
    readOnly: choice.readOnly === true,
  });
}

export function applyFirstPlayableAction(character, actionId, { occurredAt = new Date().toISOString() } = {}) {
  if (!character || typeof character !== 'object') throw new TypeError('character is required');
  const scene = getFirstPlayableScene(character);
  let baseCharacter = character;
  let outcome;

  if (String(actionId || '') === 'starter-gather') {
    const gathered = performStarterGather(character, { occurredAt });
    baseCharacter = gathered.character;
    outcome = Object.freeze({ sceneId: scene.id, actionId: 'starter-gather', result: gathered.outcome.result, progress: Object.freeze({}), worldMutation: false, nextSystem: null, itemId: gathered.outcome.itemId, quantity: gathered.outcome.quantity, readOnly: false });
  } else {
    outcome = resolveFirstPlayableAction(character, actionId);
  }

  if (outcome.readOnly) return Object.freeze({ character, outcome });

  const previousHistory = Array.isArray(baseCharacter.actionHistory) ? baseCharacter.actionHistory : [];
  const previousProgress = baseCharacter.worldProgress && typeof baseCharacter.worldProgress === 'object' ? baseCharacter.worldProgress : {};
  const worldProgress = Object.freeze(Object.entries(outcome.progress).reduce((progress, [key, amount]) => ({ ...progress, [key]: Number(previousProgress[key] || 0) + amount }), { ...previousProgress }));
  const historyEntry = Object.freeze({ sceneId: outcome.sceneId, actionId: outcome.actionId, result: outcome.result, progress: outcome.progress, worldMutation: false, occurredAt });
  const actionHistory = Object.freeze([...previousHistory, historyEntry].slice(-ACTION_HISTORY_LIMIT));
  const sceneState = Object.freeze({ sceneId: outcome.sceneId, lastActionId: outcome.actionId, lastResult: outcome.result, updatedAt: occurredAt });

  return Object.freeze({ character: Object.freeze({ ...baseCharacter, worldProgress, sceneState, actionHistory }), outcome });
}

export { ACTION_HISTORY_LIMIT };
