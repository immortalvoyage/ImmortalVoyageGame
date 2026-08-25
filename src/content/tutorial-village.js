import { validateContentPack } from './validate-content-pack.js';

export const tutorialVillagePack = Object.freeze({
  id: 'tutorial-village',
  dataVersion: 1,
  startingLocationId: 'tutorial-square',
  survival: Object.freeze({
    warningThreshold: 60,
    criticalThreshold: 85,
    restFatigueRelief: 25,
  }),
  items: Object.freeze({
    'tutorial-water': Object.freeze({
      name: '教學用飲水',
      consumeLabel: '飲用教學用飲水',
      consumeEffect: Object.freeze({ thirst: -25 }),
    }),
    'tutorial-bread': Object.freeze({
      name: '教學用乾糧',
      consumeLabel: '吃教學用乾糧',
      consumeEffect: Object.freeze({ hunger: -25 }),
    }),
  }),
  locations: Object.freeze({
    'tutorial-square': Object.freeze({
      name: '新手村廣場',
      description: '這裡的一切物品、金錢與進度都只供教學練習，不會帶入正式人生。',
      calendarZoneId: 'world-zone:origin',
      routes: Object.freeze([
        Object.freeze({
          destinationId: 'tutorial-well',
          travelSeconds: 3 * 60,
          needCosts: Object.freeze({ thirst: 1 }),
        }),
        Object.freeze({
          destinationId: 'tutorial-lodging',
          travelSeconds: 4 * 60,
          needCosts: Object.freeze({ fatigue: 1 }),
        }),
      ]),
      jobs: Object.freeze([
        Object.freeze({
          id: 'tutorial-odd-job',
          title: '教學雜役',
          label: '做一輪教學雜役',
          employerNpcId: 'tutorial-guide',
          behaviorId: 'tutorial:work:odd-job',
          rewardMoney: 2,
          needCosts: Object.freeze({ hunger: 2, thirst: 2 }),
        }),
      ]),
      market: Object.freeze([
        Object.freeze({ itemId: 'tutorial-bread', price: 1 }),
      ]),
      gatherables: Object.freeze([]),
      recipes: Object.freeze([]),
    }),
    'tutorial-well': Object.freeze({
      name: '新手村水井',
      description: '可以練習取得、查看與消耗飲水；取得的水只存在於教學沙盒。',
      calendarZoneId: 'world-zone:origin',
      routes: Object.freeze([
        Object.freeze({
          destinationId: 'tutorial-square',
          travelSeconds: 3 * 60,
          needCosts: Object.freeze({ thirst: 1 }),
        }),
      ]),
      jobs: Object.freeze([]),
      market: Object.freeze([]),
      gatherables: Object.freeze([
        Object.freeze({
          itemId: 'tutorial-water',
          quantity: 1,
          label: '練習取水',
          behaviorId: 'tutorial:gather:water',
        }),
      ]),
      recipes: Object.freeze([]),
    }),
    'tutorial-lodging': Object.freeze({
      name: '新手村休息處',
      description: '可以練習休息與恢復疲勞；這裡不是正式世界中的房產或住所。',
      calendarZoneId: 'world-zone:origin',
      rest: Object.freeze({ label: '練習休息' }),
      routes: Object.freeze([
        Object.freeze({
          destinationId: 'tutorial-square',
          travelSeconds: 4 * 60,
          needCosts: Object.freeze({ fatigue: 1 }),
        }),
      ]),
      jobs: Object.freeze([]),
      market: Object.freeze([]),
      gatherables: Object.freeze([]),
      recipes: Object.freeze([]),
    }),
  }),
  progressionTags: Object.freeze({}),
  careers: Object.freeze({}),
  knowledge: Object.freeze({}),
  npcs: Object.freeze({
    'tutorial-guide': Object.freeze({
      name: '新手村引導員',
      locationId: 'tutorial-square',
      greeting: '先四處走走，試著取水、找工作、買一份乾糧，再看看休息會發生什麼。',
      searchLabel: '尋找新手村引導員',
      knownAtStart: true,
      relationship: Object.freeze({
        behaviorId: 'tutorial:interact:guide',
        levels: Object.freeze([
          Object.freeze({
            name: '已見過',
            minCount: 1,
            responseText: '你已經知道這裡是練習場了。想確認下一步，就從眼前能做的生活行動開始。',
            topics: Object.freeze([
              Object.freeze({
                id: 'tutorial-next-steps',
                label: '問還能練習什麼',
                responseText: '可以練習移動、工作、買東西、使用背包裡的食水與休息。正式人生不會繼承這裡的資源。',
              }),
            ]),
          }),
        ]),
      }),
    }),
  }),
});

validateContentPack(tutorialVillagePack);
