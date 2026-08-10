function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${field} is required`);
  }
  return value.trim();
}

export class NpcRegistry {
  #npcs = new Map();

  registerNpc({ id, name, locationId = null, status = 'active', tags = [] }) {
    const npc = Object.freeze({
      id: requireText(id, 'id'),
      name: requireText(name, 'name'),
      locationId: locationId == null ? null : requireText(locationId, 'locationId'),
      status,
      tags: Object.freeze([...tags]),
    });
    this.#npcs.set(npc.id, npc);
    return npc;
  }

  getNpc(id) {
    return this.#npcs.get(id) ?? null;
  }

  findNpcByName(name) {
    const needle = requireText(name, 'name').toLowerCase();
    return [...this.#npcs.values()].find((npc) => npc.name.toLowerCase() === needle) ?? null;
  }
}
