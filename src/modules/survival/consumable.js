function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${field} is required`);
  return value.trim();
}

export function resolveConsume({ inventory, needs, item }) {
  if (!item) return Object.freeze({ allowed: false, reason: 'item_not_found' });
  const itemId = requireText(item.itemId, 'itemId');
  const hunger = Number(item.hunger ?? 0);
  const thirst = Number(item.thirst ?? 0);

  if ((!Number.isFinite(hunger) || hunger < 0) || (!Number.isFinite(thirst) || thirst < 0)) {
    return Object.freeze({ allowed: false, reason: 'invalid_effect' });
  }
  if (hunger === 0 && thirst === 0) return Object.freeze({ allowed: false, reason: 'not_consumable' });
  if (!inventory.remove(itemId, 1)) return Object.freeze({ allowed: false, reason: 'not_in_inventory' });

  const state = needs.consume({ hunger, thirst });
  return Object.freeze({ allowed: true, itemId, quantity: 1, state, requiresNarrative: false });
}
