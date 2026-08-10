export function resolveGather({ playerLocationId, resourceRegistry, resourceId, inventory, quantity = 1 }) {
  const resource = resourceRegistry.get(resourceId);
  if (!resource) return Object.freeze({ allowed: false, reason: 'resource_not_found' });
  if (resource.locationId !== playerLocationId) return Object.freeze({ allowed: false, reason: 'wrong_location' });
  if (resource.quantity <= 0) return Object.freeze({ allowed: false, reason: 'depleted' });

  const gathered = resourceRegistry.gather(resourceId, quantity);
  if (!gathered) return Object.freeze({ allowed: false, reason: 'depleted' });

  inventory.add(gathered.itemId, gathered.quantity);
  return Object.freeze({
    allowed: true,
    itemId: gathered.itemId,
    quantity: gathered.quantity,
    requiresNarrative: false,
  });
}
