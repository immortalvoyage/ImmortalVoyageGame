import { validateContentPack } from './validate-content-pack.js';

export const devStarterPack = Object.freeze({
  id: 'dev-starter',
  dataVersion: 12,
  startingLocationId: 'starter-square',
  survival: Object.freeze({
    warningThreshold: 60,
    criticalThreshold: 85,
    restFatigueRelief: 25,
  }),
  items: Object.freeze({
    water: Object.freeze({
      name: '水',
      consumeLabel: '飲水',
      consumeEffect: Object.freeze({ thirst: -25 }),
    }),
    food: Object.freeze({
      name: '食物',
      consumeLabel: '進食',
      consumeEffect: Object.freeze({ hunger: -25 }),
    }),
    'simple-meal': Object.freeze({
      name: '簡單餐食',
      consumeLabel: '吃簡單餐食',
      consumeEffect: Object.freeze({ hunger: -35, thirst: -15 }),
    }),
  }),
  locations: Object.freeze({
    'starter-square': Object.freeze({
      name: '開發聚落廣場',
      description: '供 V2 垂直切片驗證使用的臨時聚落。',
      routes: Object.freeze(['starter-well', 'starter-grove']),
      jobs: Object.freeze([
        Object.freeze({
          id: 'starter-labor',
          label: '找一份雜役工作',
          behaviorId: 'work:starter-labor',
          rewardMoney: 2,
          needCosts: Object.freeze({ hunger: 5, thirst: 5 }),
        }),
      ]),
      market: Object.freeze([
        Object.freeze({ itemId: 'food', price: 1 }),
        Object.freeze({ itemId: 'water', price: 1 }),
      ]),
      gatherables: Object.freeze([]),
      recipes: Object.freeze([
        Object.freeze({
          id: 'starter-simple-meal',
          label: '製作簡單餐食',
          behaviorId: 'craft:starter-simple-meal',
          inputs: Object.freeze([
            Object.freeze({ itemId: 'food', quantity: 1 }),
            Object.freeze({ itemId: 'water', quantity: 1 }),
          ]),
          output: Object.freeze({ itemId: 'simple-meal', quantity: 1 }),
        }),
      ]),
    }),
    'starter-well': Object.freeze({
      name: '公共水井',
      description: '可取得基礎飲水。',
      routes: Object.freeze(['starter-square']),
      jobs: Object.freeze([]),
      market: Object.freeze([]),
      gatherables: Object.freeze([
        Object.freeze({ itemId: 'water', quantity: 1, label: '在水井取水', behaviorId: 'gather:water' }),
      ]),
      recipes: Object.freeze([]),
    }),
    'starter-grove': Object.freeze({
      name: '近郊樹林',
      description: '可採集少量基礎食物。',
      routes: Object.freeze(['starter-square']),
      jobs: Object.freeze([]),
      market: Object.freeze([]),
      gatherables: Object.freeze([
        Object.freeze({ itemId: 'food', quantity: 1, label: '採集可食用的東西', behaviorId: 'gather:food' }),
      ]),
      recipes: Object.freeze([]),
    }),
  }),
  progressionTags: Object.freeze({
    'starter-odd-job-regular': Object.freeze({
      name: '常做雜役',
      kind: 'social',
      requirements: Object.freeze([
        Object.freeze({ behaviorId: 'work:starter-labor', minCount: 2 }),
      ]),
    }),
    'starter-foraging-basics': Object.freeze({
      name: '採集入門',
      kind: 'skill',
      requirements: Object.freeze([
        Object.freeze({ behaviorId: 'gather:food', minCount: 2 }),
      ]),
    }),
    'starter-simple-cooking': Object.freeze({
      name: '簡單料理',
      kind: 'skill',
      requirements: Object.freeze([
        Object.freeze({ behaviorId: 'craft:starter-simple-meal', minCount: 1 }),
      ]),
    }),
  }),
  careers: Object.freeze({
    'starter-labor-hand': Object.freeze({
      name: '聚落雜役熟手',
      requirements: Object.freeze([
        Object.freeze({ behaviorId: 'work:starter-labor', minCount: 3 }),
      ]),
    }),
  }),
  npcs: Object.freeze({
    foreman: Object.freeze({
      name: '聚落雜役領班',
      locationId: 'starter-square',
      greeting: '這裡總有些搬運和整理的活計。',
      searchLabel: '尋找聚落雜役領班',
      knownAtStart: true,
      relationship: Object.freeze({
        behaviorId: 'interact:npc:foreman',
        levels: Object.freeze([
          Object.freeze({
            name: '見過幾面',
            minCount: 1,
            responseText: '又來了？這裡的活還是那些，熟門熟路就自己看著辦。',
            topics: Object.freeze([
              Object.freeze({
                id: 'foreman-work-rumors',
                label: '問問最近的雜役消息',
                responseText: '最近搬運和整理的活不少，想賺些小錢還是先從眼前能做的事開始。',
              }),
            ]),
          }),
          Object.freeze({
            name: '逐漸熟悉',
            minCount: 3,
            responseText: '最近常看到你，這些雜活你也做熟了。',
            topics: Object.freeze([
              Object.freeze({
                id: 'foreman-living-advice',
                label: '問問在聚落討生活的建議',
                responseText: '先把吃喝和休息顧好，再談長遠打算；近郊樹林裡也常有一名採藥人出沒。',
                revealsNpcIds: Object.freeze(['herbalist']),
              }),
            ]),
          }),
          Object.freeze({
            name: '熟識',
            minCount: 5,
            responseText: '你算是這裡的熟面孔了，有活我會先想到你。',
          }),
        ]),
      }),
    }),
    herbalist: Object.freeze({
      name: '近郊採藥人',
      locationId: 'starter-grove',
      greeting: '採藥時別踩壞旁邊剛長出的嫩芽。',
      searchLabel: '尋找近郊採藥人',
    }),
  }),
});

validateContentPack(devStarterPack);
