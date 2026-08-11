function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${field} is required`);
  return value.trim();
}

function requireQuantity(value) {
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity <= 0) throw new TypeError('quantity must be a positive integer');
  return quantity;
}

export class Inventory {
  #items = new Map();

  add(itemId, quantity = 1) {
    const id = requireText(itemId, 'itemId');
    const amount = requireQuantity(quantity);
    this.#items.set(id, (this.#items.get(id) ?? 0) + amount);
    return this.get(id);
  }

  remove(itemId, quantity = 1) {
    const id = requireText(itemId, 'itemId');
    const amount = requireQuantity(quantity);
    const current = this.#items.get(id) ?? 0;
    if (current < amount) return false;
    const next = current - amount;
    if (next === 0) this.#items.delete(id);
    else this.#items.set(id, next);
    return true;
  }

  get(itemId) {
    return this.#items.get(requireText(itemId, 'itemId')) ?? 0;
  }

  entries() {
    return [...this.#items.entries()].map(([itemId, quantity]) => Object.freeze({ itemId, quantity }));
  }
}

export function inventoryFromCharacter(character) {
  const inventory = new Inventory();
  const items = Array.isArray(character?.inventory?.items) ? character.inventory.items : [];
  for (const item of items) inventory.add(item.itemId, item.quantity);
  return inventory;
}

export function attachInventoryToCharacter(character, inventory) {
  if (!character || typeof character !== 'object') throw new TypeError('character is required');
  if (!(inventory instanceof Inventory)) throw new TypeError('inventory is required');
  return Object.freeze({
    ...character,
    inventory: Object.freeze({ schemaVersion: 1, items: Object.freeze(inventory.entries()) }),
  });
}
