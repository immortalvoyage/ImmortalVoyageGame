function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${field} is required`);
  }
  return value.trim();
}

export class LocationRegistry {
  #locations = new Map();
  #routes = new Map();

  registerLocation({ id, name, tags = [] }) {
    const location = Object.freeze({
      id: requireText(id, 'id'),
      name: requireText(name, 'name'),
      tags: Object.freeze([...tags]),
    });
    this.#locations.set(location.id, location);
    return location;
  }

  registerRoute({ from, to, travelCost = 1, status = 'open', tags = [] }) {
    const route = Object.freeze({
      from: requireText(from, 'from'),
      to: requireText(to, 'to'),
      travelCost: Number.isFinite(travelCost) && travelCost >= 0 ? travelCost : 1,
      status,
      tags: Object.freeze([...tags]),
    });
    this.#routes.set(`${route.from}->${route.to}`, route);
    return route;
  }

  getLocation(id) {
    return this.#locations.get(id) ?? null;
  }

  findLocationByName(name) {
    const needle = requireText(name, 'name').toLowerCase();
    return [...this.#locations.values()].find((location) => location.name.toLowerCase() === needle) ?? null;
  }

  getRoute(from, to) {
    return this.#routes.get(`${from}->${to}`) ?? null;
  }
}
