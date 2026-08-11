import { getItemMetadata } from './item-catalog.js';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
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
    return `<article class="inventory-item-card" data-item-id="${escapeHtml(item.id)}"><div class="inventory-item-visual">${image}</div><div class="inventory-item-copy"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.category)} · ${escapeHtml(item.rarity)}</small></div><span class="inventory-item-quantity">×${Number(stack.quantity)}</span></article>`;
  }).join('')}</div>`;
}
