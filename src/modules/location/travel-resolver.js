const BLOCKED_ROUTE_STATUSES = new Set(['blocked', 'closed', 'war_locked']);

export function resolveTravel({ registry, fromLocationId, targetName }) {
  const target = registry.findLocationByName(targetName);
  if (!target) {
    return Object.freeze({
      allowed: false,
      reason: 'unknown_location',
      requiresNarrative: false,
      target: null,
    });
  }

  if (fromLocationId === target.id) {
    return Object.freeze({
      allowed: true,
      reason: 'already_there',
      requiresNarrative: false,
      target,
      route: null,
    });
  }

  const route = registry.getRoute(fromLocationId, target.id);
  if (!route) {
    return Object.freeze({
      allowed: false,
      reason: 'no_route',
      requiresNarrative: false,
      target,
      route: null,
    });
  }

  if (BLOCKED_ROUTE_STATUSES.has(route.status)) {
    return Object.freeze({
      allowed: false,
      reason: route.status,
      requiresNarrative: true,
      target,
      route,
    });
  }

  return Object.freeze({
    allowed: true,
    reason: 'route_available',
    requiresNarrative: route.tags.length > 0,
    target,
    route,
  });
}
