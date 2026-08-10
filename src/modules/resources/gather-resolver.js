export function resolveGather({ playerLocationId, resource, inventory, quantity = 1 }) {
  if (!resource) return Object.freeze({ allowed: false, reason: 'resource_not_found' });
  if (resource.locationId !== playerLocationId) return Object.freeze({ allowed: false, reason: 'wrong_location' });
  if (!resource.itemId || resource.quantity <= 0) return Object.freeze({ allowed: false, reason: 'depleted' });

  const gatheredQuantity = Math.min(quantity, resource.quantity);
  if (!Number.isInteger(gatheredQuantity) || gatheredQuantity <= 0) {
    return Object.freeze({ allowed: false, reason: 'invalid_quantity' });
  }

  inventory.add(resource.itemId, gatheredQuantity);
  return Object.freeze({
    allowed: true,
    itemId: resource.itemId,
    quantity: gatheredQuantity,
    requiresNarrative: false,
  });
}
