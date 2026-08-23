export const devStarterPack = Object.freeze({
  id: 'dev-starter',
  dataVersion: 1,
  locations: Object.freeze({
    'starter-square': Object.freeze({
      name: '開發聚落廣場',
      description: '供 V2 垂直切片驗證使用的臨時聚落。',
      routes: Object.freeze(['starter-well', 'starter-grove']),
    }),
    'starter-well': Object.freeze({
      name: '公共水井',
      description: '可取得基礎飲水。',
      routes: Object.freeze(['starter-square']),
    }),
    'starter-grove': Object.freeze({
      name: '近郊樹林',
      description: '可採集少量基礎食物。',
      routes: Object.freeze(['starter-square']),
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
