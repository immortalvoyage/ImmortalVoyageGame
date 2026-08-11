const ITEM_CATALOG = Object.freeze({
  shellfish: Object.freeze({
    id: 'shellfish',
    name: '潮間貝類',
    category: 'food',
    rarity: 'common',
    visual: Object.freeze({ iconKey: 'shellfish', motion: 'none' }),
  }),
  'wild-berry': Object.freeze({
    id: 'wild-berry',
    name: '野莓',
    category: 'food',
    rarity: 'common',
    visual: Object.freeze({ iconKey: 'wild-berry', motion: 'none' }),
  }),
  'wild-herb': Object.freeze({
    id: 'wild-herb',
    name: '可用野草',
    category: 'material',
    rarity: 'common',
    visual: Object.freeze({ iconKey: 'wild-herb', motion: 'none' }),
  }),
});

export function getItemMetadata(itemId) {
  const id = String(itemId || '').trim();
  if (!id) return null;
  return ITEM_CATALOG[id] ?? Object.freeze({
    id,
    name: id,
    category: 'unknown',
    rarity: 'common',
    visual: Object.freeze({ iconKey: id, motion: 'none' }),
  });
}

export function describeItemStack(itemId, quantity) {
  const item = getItemMetadata(itemId);
  return `${item.name} × ${Number(quantity)}`;
}

export { ITEM_CATALOG };
