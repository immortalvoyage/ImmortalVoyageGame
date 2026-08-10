export class ModuleRegistry {
  #modules = new Map();

  register(moduleDefinition) {
    const { id, enabledByDefault = true, handlers = {} } = moduleDefinition ?? {};
    if (!id || typeof id !== "string") throw new TypeError("Module id is required");
    if (this.#modules.has(id)) throw new Error(`Module already registered: ${id}`);
    this.#modules.set(id, { id, enabledByDefault: Boolean(enabledByDefault), handlers });
    return this.#modules.get(id);
  }

  get(id) {
    return this.#modules.get(id) ?? null;
  }

  list() {
    return [...this.#modules.values()];
  }
}
