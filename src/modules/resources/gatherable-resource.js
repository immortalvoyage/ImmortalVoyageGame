function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${field} is required`);
  return value.trim();
}

function requireNonNegativeInteger(value, field) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new TypeError(`${field} must be a non-negative integer`);
  return number;
}

export class GatherableResourceRegistry {
  #resources = new Map();

  register({ id, locationId, itemId, quantity, tags = [] }) {
    const resource = {
      id: requireText(id, 'id'),
      locationId: requireText(locationId, 'locationId'),
      itemId: requireText(itemId, 'itemId'),
      quantity: requireNonNegativeInteger(quantity, 'quantity'),
      tags: Object.freeze([...tags]),
    };
    this.#resources.set(resource.id, resource);
    return this.get(resource.id);
  }

  get(id) {
    const resource = this.#resources.get(requireText(id, 'id'));
    return resource ? Object.freeze({ ...resource }) : null;
  }

  listAt(locationId) {
    const id = requireText(locationId, 'locationId');
    return [...this.#resources.values()]
      .filter((resource) => resource.locationId === id && resource.quantity > 0)
      .map((resource) => Object.freeze({ ...resource }));
  }

  gather(id, requestedQuantity = 1) {
    const resourceId = requireText(id, 'id');
    const amount = Number(requestedQuantity);
    if (!Number.isInteger(amount) || amount <= 0) throw new TypeError('requestedQuantity must be a positive integer');

    const resource = this.#resources.get(resourceId);
    if (!resource || resource.quantity <= 0) return null;

    const gathered = Math.min(amount, resource.quantity);
    resource.quantity -= gathered;
    return Object.freeze({ itemId: resource.itemId, quantity: gathered, resourceId });
  }
}
