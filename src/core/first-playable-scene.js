const SCENES = Object.freeze({
  coast: Object.freeze({
    title: '潮聲初醒',
    body: '鹹濕的風穿過屋縫，遠處傳來繩索拍擊桅杆的聲音。你知道港口已經醒了，而你也必須決定今天先往哪裡走。',
    choices: Object.freeze([
      Object.freeze({ id: 'observe', label: '先觀察港口', result: '你先沒有急著靠近人群，而是記下碼頭、貨棧與巡邏者的位置。這些情報暫時沒有改變世界，卻讓你對周遭多了一分把握。' }),
      Object.freeze({ id: 'seek-work', label: '往碼頭找活做', result: '你朝最吵雜的碼頭走去。扛貨、補網、跑腿與臨時船工的招呼聲此起彼落；這裡很可能成為你第一份收入的起點。' }),
      Object.freeze({ id: 'explore', label: '沿海岸走走', result: '你避開港口中心，沿著潮線往外走。礁石、漂流物與陌生腳印讓你意識到，海邊不只有工作，也藏著許多尚未被注意的痕跡。' }),
    ]),
  }),
  forest: Object.freeze({
    title: '林間初醒',
    body: '晨霧還掛在樹梢，鳥鳴與遠處的斧聲交錯。林子能給人食物，也能藏住危險；你得先決定怎麼度過這一天。',
    choices: Object.freeze([
      Object.freeze({ id: 'observe', label: '先辨認周遭', result: '你花時間觀察水源、獸徑與人走過的痕跡。沒有收穫立刻落進手裡，但你避免了毫無準備地闖進更深的林子。' }),
      Object.freeze({ id: 'seek-work', label: '循斧聲找人', result: '你循著斧聲前進，很快看見有人整理木料。砍柴、搬運、採集與跑腿，都可能成為你換取第一頓飯的方法。' }),
      Object.freeze({ id: 'explore', label: '往林中探索', result: '你沿著較少人走的小徑深入。泥土上的足跡和折斷的枝條提醒你：這片林地不是空無一人，也不是完全安全。' }),
    ]),
  }),
  grassland: Object.freeze({
    title: '風原初醒',
    body: '風吹過大片草浪，遠處炊煙與牲畜的影子若隱若現。這裡看似開闊，真正的道路卻藏在人群、水源與季節之間。',
    choices: Object.freeze([
      Object.freeze({ id: 'observe', label: '登高觀望', result: '你先找了稍高的地勢辨認水源、煙柱與道路。開闊地讓方向更容易確認，也讓自己的位置更容易被別人看見。' }),
      Object.freeze({ id: 'seek-work', label: '往炊煙方向走', result: '你朝有人煙的方向走去。放牧、修繕、運送與照料牲畜，都是能讓陌生人換到食物與信任的工作。' }),
      Object.freeze({ id: 'explore', label: '沿水草尋路', result: '你沿著較茂盛的草地前進，希望找到水與人跡。遠處留下的車轍證明，這裡曾有其他旅人經過。' }),
    ]),
  }),
});

function sceneKey(character) {
  const tags = Array.isArray(character?.birthRegionTags) ? character.birthRegionTags : [];
  if (tags.includes('coast') || tags.includes('island') || tags.includes('urban')) return 'coast';
  if (tags.includes('forest') || tags.includes('mountain')) return 'forest';
  return 'grassland';
}

export function getFirstPlayableScene(character) {
  const scene = SCENES[sceneKey(character)];
  return Object.freeze({
    id: `birth-${sceneKey(character)}`,
    title: scene.title,
    body: scene.body,
    choices: scene.choices,
  });
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
    worldMutation: false,
  });
}
