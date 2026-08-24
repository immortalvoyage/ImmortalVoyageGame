import { validateContentPack } from './validate-content-pack.js';

// First formal-life vertical-slice candidate. Names are intentionally low-lore and
// must not be treated as final novel/world canon until the opening-world SSOT fixes them.
export const firstSettlementPack = Object.freeze({
  id: 'first-settlement-candidate',
  dataVersion: 1,
  startingLocationId: 'first-square',
  survival: Object.freeze({
    warningThreshold: 60,
    criticalThreshold: 85,
    restFatigueRelief: 25,
  }),
  items: Object.freeze({
    'drinking-water': Object.freeze({
      name: '飲用水',
      consumeLabel: '喝水',
      consumeEffect: Object.freeze({ thirst: -30 }),
    }),
    'coarse-bread': Object.freeze({
      name: '粗麵餅',
      consumeLabel: '吃粗麵餅',
      consumeEffect: Object.freeze({ hunger: -30 }),
    }),
    'wild-fruit': Object.freeze({
      name: '野果',
      consumeLabel: '吃野果',
      consumeEffect: Object.freeze({ hunger: -20, thirst: -5 }),
    }),
    'simple-ration': Object.freeze({
      name: '簡單乾糧',
      consumeLabel: '吃簡單乾糧',
      consumeEffect: Object.freeze({ hunger: -40, thirst: -10 }),
    }),
  }),
  locations: Object.freeze({
    'first-square': Object.freeze({
      name: '初始聚落街口',
      description: '人流與小買賣集中在這裡，想找活、補充基本食物或打聽方向都不算困難。',
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
          needCosts: Object.freeze({ hunger: 4, thirst: 5, fatigue: 2 }),
        }),
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
      name: '公共水井',
      description: '有人維護的公共水井提供安全的日常飲水，是沒有錢時仍能取得水的基本去處。',
      routes: Object.freeze([
        Object.freeze({ destinationId: 'first-square', travelSeconds: 5 * 60, needCosts: Object.freeze({ thirst: 1 }) }),
      ]),
      jobs: Object.freeze([]),
      market: Object.freeze([]),
      gatherables: Object.freeze([
        Object.freeze({ itemId: 'drinking-water', quantity: 1, label: '在公共水井取水', behaviorId: 'gather:first-water' }),
      ]),
      recipes: Object.freeze([]),
    }),
    'first-outskirts': Object.freeze({
      name: '近郊採集地',
      description: '聚落外緣仍找得到少量可食野果；產量不高，但足以作為最基本的求生退路。',
      routes: Object.freeze([
        Object.freeze({ destinationId: 'first-square', travelSeconds: 12 * 60, needCosts: Object.freeze({ hunger: 1, thirst: 1 }) }),
      ]),
      jobs: Object.freeze([]),
      market: Object.freeze([]),
      gatherables: Object.freeze([
        Object.freeze({ itemId: 'wild-fruit', quantity: 1, label: '尋找可食野果', behaviorId: 'gather:first-fruit' }),
      ]),
      recipes: Object.freeze([]),
    }),
    'first-lodging': Object.freeze({
      name: '公共通鋪',
      description: '一處規矩簡單的公共通鋪。有人維持基本秩序，也會找人做打掃整理的短工。',
      rest: Object.freeze({ label: '在公共通鋪休息' }),
      routes: Object.freeze([
        Object.freeze({ destinationId: 'first-square', travelSeconds: 4 * 60, needCosts: Object.freeze({ fatigue: 1 }) }),
      ]),
      jobs: Object.freeze([
        Object.freeze({
          id: 'first-lodging-work',
          title: '通鋪雜役',
          label: '做一輪通鋪整理',
          employerNpcId: 'first-lodging-keeper',
          behaviorId: 'work:first-lodging',
          rewardMoney: 2,
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
      name: '通鋪熟面孔',
      kind: 'social',
      requirements: Object.freeze([Object.freeze({ behaviorId: 'work:first-lodging', minCount: 2 })]),
    }),
    'first-foraging-basics': Object.freeze({
      name: '近郊採集入門',
      kind: 'skill',
      requirements: Object.freeze([Object.freeze({ behaviorId: 'gather:first-fruit', minCount: 2 })]),
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
      name: '通鋪雜役熟手',
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
                responseText: '沒錢先去公共水井取水，近郊也找得到些野果；累了就去公共通鋪。',
                grantsKnowledgeIds: Object.freeze(['first-living-basics']),
              }),
            ]),
          }),
        ]),
      }),
    }),
    'first-lodging-keeper': Object.freeze({
      name: '通鋪管事',
      locationId: 'first-lodging',
      greeting: '要休息就守規矩；想賺點小錢，也有打掃整理的活。',
      searchLabel: '尋找通鋪管事',
      knownAtStart: true,
      relationship: Object.freeze({
        behaviorId: 'interact:npc:first-lodging-keeper',
        levels: Object.freeze([
          Object.freeze({ name: '見過幾面', minCount: 1, responseText: '通鋪不講排場，能安穩睡一覺就好。' }),
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
