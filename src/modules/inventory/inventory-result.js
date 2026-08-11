import { renderInventoryItems } from './inventory-view.js';

export function renderInventoryResult(character) {
  return `<section class="inventory-panel" aria-labelledby="inventory-title"><header class="inventory-panel-heading"><p class="eyebrow">行囊</p><h1 id="inventory-title">隨身之物</h1><p class="subtitle compact">你攜帶的物品都在這裡。物品本身不會因查看而改變世界狀態。</p></header>${renderInventoryItems(character)}</section>`;
}
