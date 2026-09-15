import { validateContentPack } from './validate-content-pack.js';

// First formal-life vertical-slice candidate. Names are intentionally low-lore and
// must not be treated as final novel/world canon until the opening-world SSOT fixes them.
export const firstSettlementPack = Object.freeze({
  id: 'first-settlement-candidate',
  dataVersion: 8,
  startingLocationId: 'first-square',
  birthLocations: Object.freeze(['first-square']),
  inventory: Object.freeze({ carryCapacityUnits: 20 }),
  survival: Object.freeze({
    warningThreshold: 60,
    criticalThreshold: 85,
    restFatigueRelief: 25,
  }),
  items: Object.freeze({
    'drinking-water': Object.freeze({
      carryUnits: 1,
      name: '飲用水',
      consumeLabel: '喝水',
      consumeEffect: Object.freeze({ thirst: -30 }),
    }),
    'coarse-bread': Object.freeze({
      carryUnits: 1,
      name: '粗麵餅',
      consumeLabel: '吃粗麵餅',
      consumeEffect: Object.freeze({ hunger: -30 }),
    }),
    'simple-ration': Object.freeze({
      carryUnits: 1,
      name: '簡單乾糧',
      consumeLabel: '吃簡單乾糧',
      consumeEffect: Object.freeze({ hunger: -40, thirst: -10 }),
    }),
  }),
  locations: Object.freeze({
    'first-square': Object.freeze({
      name: '初始聚落街口',
      description: '人流與小買賣集中在這裡，想找活、補充基本食物或打聽方向都不算困難。',
      calendarZoneId: 'world-zone:origin',
      routes: Object.freeze([
        Object.freeze({ destinationId: 'first-well', travelSeconds: 5 * 60, needCosts: Object.freeze({ thirst: 1 }) }),
        Object.freeze({ destinationId: 'first-outskirts', travelSeconds: 12 * 60, needCosts: Object.freeze({ hunger: 1, thirst: 1 }) }),
        Object.freeze({ destinationId: 'first-lodging', travelSeconds: 4 * 60, needCosts: Object.freeze({ fatigue: 1 }) }),
      ]),
      jobs: Object.freeze([
        Object.freeze({
          id: 'first-carrying-work',
          title: '搬運雜役',
          label: '做一輪搬運雜役',
          employerNpcId: 'first-foreman',
          behaviorId: 'work:first-carrying',
          rewardMoney: 2,
          durationSeconds: 5 * 60,
          needCosts: Object.freeze({ hunger: 4, thirst: 5, fatigue: 2 }),
        }),
      ]),
      recoveryWork: Object.freeze([
        Object.freeze({ id: 'first-meal-recovery-work', label: '幫忙做一小段臨時雜務，換取一份基本食物', behaviorId: 'recovery-work:first-meal', reward: Object.freeze({ itemId: 'coarse-bread', quantity: 1 }) }),
        Object.freeze({ id: 'first-water-recovery-work', label: '幫忙做一小段臨時雜務，換取一份飲水', behaviorId: 'recovery-work:first-water', reward: Object.freeze({ itemId: 'drinking-water', quantity: 1 }) }),
      ]),
      market: Object.freeze([
        Object.freeze({ itemId: 'coarse-bread', price: 1 }),
        Object.freeze({ itemId: 'drinking-water', price: 1 }),
      ]),
      gatherables: Object.freeze([]),
      recipes: Object.freeze([
        Object.freeze({
          id: 'first-simple-ration',
          label: '整理一份簡單乾糧',
          behaviorId: 'craft:first-simple-ration',
          inputs: Object.freeze([
            Object.freeze({ itemId: 'coarse-bread', quantity: 1 }),
            Object.freeze({ itemId: 'drinking-water', quantity: 1 }),
          ]),
          output: Object.freeze({ itemId: 'simple-ration', quantity: 1 }),
        }),
      ]),
    }),
    'first-well': Object.freeze({
      name: '聚落供水處',
      description: '聚落裡集中處理日常用水的地方；能否直接取用、如何交換或由誰維持，都依當地規矩而定。',
      calendarZoneId: 'world-zone:origin',
      routes: Object.freeze([
        Object.freeze({ destinationId: 'first-square', travelSeconds: 5 * 60, needCosts: Object.freeze({ thirst: 1 }) }),
      ]),
      jobs: Object.freeze([]),
      market: Object.freeze([]),
      gatherables: Object.freeze([]),
      recipes: Object.freeze([]),
    }),
    'first-outskirts': Object.freeze({
      name: '聚落外緣',
      description: '人煙漸少，幾條路向聚落外側延伸；離開聚落後能遇到什麼，沒有固定保證。',
      calendarZoneId: 'world-zone:origin',
      externalRouteStaging: true,
      routes: Object.freeze([
        Object.freeze({ destinationId: 'first-square', travelSeconds: 12 * 60, needCosts: Object.freeze({ hunger: 1, thirst: 1 }) }),
      ]),
      jobs: Object.freeze([]),
      market: Object.freeze([]),
      gatherables: Object.freeze([]),
      recipes: Object.freeze([]),
    }),
    'first-lodging': Object.freeze({
      name: '簡易宿所',
      description: '一處可以合法停留休息的簡易宿所，規矩樸素，也會找人做打掃整理的短工。',
      calendarZoneId: 'world-zone:origin',
      rest: Object.freeze({ label: '在簡易宿所休息' }),
      shelter: Object.freeze({ absenceSurvivalCapSeconds: 6 * 60 * 60 }),
      routes: Object.freeze([
        Object.freeze({ destinationId: 'first-square', travelSeconds: 4 * 60, needCosts: Object.freeze({ fatigue: 1 }) }),
      ]),
      jobs: Object.freeze([
        Object.freeze({
          id: 'first-lodging-work',
          title: '宿所雜役',
          label: '做一輪宿所整理',
          employerNpcId: 'first-lodging-keeper',
          behaviorId: 'work:first-lodging',
          rewardMoney: 2,
          durationSeconds: 5 * 60,
          needCosts: Object.freeze({ hunger: 3, thirst: 3, fatigue: 3 }),
        }),
      ]),
      market: Object.freeze([]),
      gatherables: Object.freeze([]),
      recipes: Object.freeze([]),
    }),
  }),
  progressionTags: Object.freeze({
    'first-carrying-regular': Object.freeze({
      name: '搬運熟手',
      kind: 'social',
      requirements: Object.freeze([Object.freeze({ behaviorId: 'work:first-carrying', minCount: 2 })]),
    }),
    'first-lodging-regular': Object.freeze({
      name: '宿所熟面孔',
      kind: 'social',
      requirements: Object.freeze([Object.freeze({ behaviorId: 'work:first-lodging', minCount: 2 })]),
    }),
    'first-ration-prep': Object.freeze({
      name: '乾糧整理',
      kind: 'skill',
      requirements: Object.freeze([Object.freeze({ behaviorId: 'craft:first-simple-ration', minCount: 1 })]),
    }),
  }),
  careers: Object.freeze({
    'first-laborer': Object.freeze({
      name: '聚落短工熟手',
      requirements: Object.freeze([Object.freeze({ behaviorId: 'work:first-carrying', minCount: 3 })]),
    }),
    'first-lodging-hand': Object.freeze({
      name: '宿所雜役熟手',
      requirements: Object.freeze([Object.freeze({ behaviorId: 'work:first-lodging', minCount: 3 })]),
    }),
  }),
  knowledge: Object.freeze({
    'first-living-basics': Object.freeze({
      name: '初始聚落的基本生活去處',
    }),
  }),
  npcs: Object.freeze({
    'first-foreman': Object.freeze({
      name: '搬運領班',
      locationId: 'first-square',
      greeting: '想做短工就先把自己的狀況顧好，搬運不缺人，但也不收撐不住的人。',
      searchLabel: '尋找搬運領班',
      knownAtStart: true,
      relationship: Object.freeze({
        behaviorId: 'interact:npc:first-foreman',
        levels: Object.freeze([
          Object.freeze({
            name: '見過幾面',
            minCount: 1,
            responseText: '還想找活？先看看自己餓不餓、渴不渴。',
            topics: Object.freeze([
              Object.freeze({
                id: 'first-foreman-living-basics',
                label: '問問基本生活去處',
                responseText: '真撐不住時，街口有臨時雜務能換一份基本食物或飲水；累了就找能合法休息的宿所。',
                grantsKnowledgeIds: Object.freeze(['first-living-basics']),
              }),
            ]),
          }),
        ]),
      }),
    }),
    'first-lodging-keeper': Object.freeze({
      name: '宿所管事',
      locationId: 'first-lodging',
      greeting: '要休息就守規矩；想賺點小錢，也有打掃整理的活。',
      searchLabel: '尋找宿所管事',
      knownAtStart: true,
      relationship: Object.freeze({
        behaviorId: 'interact:npc:first-lodging-keeper',
        levels: Object.freeze([
          Object.freeze({ name: '見過幾面', minCount: 1, responseText: '宿所不講排場，能安穩睡一覺就好。' }),
        ]),
      }),
    }),
    'first-vendor': Object.freeze({
      name: '街口小販',
      locationId: 'first-square',
      greeting: '粗麵餅和飲水都不貴，先顧肚子再想別的。',
      searchLabel: '尋找街口小販',
      knownAtStart: true,
    }),
  }),
});

validateContentPack(firstSettlementPack);
