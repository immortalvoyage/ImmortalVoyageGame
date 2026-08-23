export const devStarterPack = Object.freeze({
  id: 'dev-starter',
  dataVersion: 2,
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
          rewardMoney: 2,
          needCosts: Object.freeze({ hunger: 5, thirst: 5 }),
        }),
      ]),
      market: Object.freeze([
        Object.freeze({ itemId: 'food', price: 1 }),
        Object.freeze({ itemId: 'water', price: 1 }),
      ]),
      gatherables: Object.freeze([]),
    }),
    'starter-well': Object.freeze({
      name: '公共水井',
      description: '可取得基礎飲水。',
      routes: Object.freeze(['starter-square']),
      jobs: Object.freeze([]),
      market: Object.freeze([]),
      gatherables: Object.freeze([
        Object.freeze({ itemId: 'water', quantity: 1, label: '在水井取水' }),
      ]),
    }),
    'starter-grove': Object.freeze({
      name: '近郊樹林',
      description: '可採集少量基礎食物。',
      routes: Object.freeze(['starter-square']),
      jobs: Object.freeze([]),
      market: Object.freeze([]),
      gatherables: Object.freeze([
        Object.freeze({ itemId: 'food', quantity: 1, label: '採集可食用的東西' }),
      ]),
    }),
  }),
  npcs: Object.freeze({
    foreman: Object.freeze({
      name: '聚落雜役領班',
      locationId: 'starter-square',
      greeting: '這裡總有些搬運和整理的活計。',
    }),
  }),
});
