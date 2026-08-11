import { getItemMetadata } from './item-catalog.js';

const CATEGORY_LABELS = Object.freeze({
  food: '食物',
  material: '材料',
  equipment: '裝備',
  quest: '任務',
  unknown: '其他',
});

const RARITY_LABELS = Object.freeze({
  common: '普通',
  uncommon: '少見',
  rare: '稀有',
  epic: '史詩',
  legendary: '傳奇',
});

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function displayLabel(map, value, fallback) {
  return map[String(value || '')] ?? fallback;
}

export function renderInventoryItems(character) {
  const items = Array.isArray(character?.inventory?.items)
    ? character.inventory.items.filter((item) => item && Number(item.quantity) > 0)
    : [];

  if (!items.length) return '<p class="inventory-empty">你的行囊目前是空的。</p>';

  return `<div class="inventory-grid">${items.map((stack) => {
    const item = getItemMetadata(stack.itemId);
    const image = item.visual?.assetPath
      ? `<img class="inventory-item-icon" src="${escapeHtml(item.visual.assetPath)}" alt="" width="72" height="72">`
      : `<span class="inventory-item-glyph" aria-hidden="true">${escapeHtml(item.visual?.glyph || '·')}</span>`;
    const category = displayLabel(CATEGORY_LABELS, item.category, '其他');
    const rarity = displayLabel(RARITY_LABELS, item.rarity, '普通');
    return `<article class="inventory-item-card" data-item-id="${escapeHtml(item.id)}"><div class="inventory-item-visual">${image}</div><div class="inventory-item-copy"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(category)} · ${escapeHtml(rarity)}</small></div><span class="inventory-item-quantity">×${Number(stack.quantity)}</span></article>`;
  }).join('')}</div>`;
}
