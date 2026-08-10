export class ActionResolver {
  constructor({ moduleRegistry, featureFlags, eventBus } = {}) {
    this.moduleRegistry = moduleRegistry;
    this.featureFlags = featureFlags;
    this.eventBus = eventBus;
  }

  async resolve(action, context = {}) {
    if (!action?.type) throw new TypeError("Action type is required");

    for (const moduleDefinition of this.moduleRegistry?.list?.() ?? []) {
      const flagName = `module.${moduleDefinition.id}`;
      const enabled = this.featureFlags?.isEnabled?.(flagName) ?? moduleDefinition.enabledByDefault;
      if (!enabled) continue;

      const handler = moduleDefinition.handlers?.[action.type];
      if (typeof handler !== "function") continue;

      const result = await handler({ action, context });
      await this.eventBus?.emit?.("action.resolved", {
        action,
        context,
        moduleId: moduleDefinition.id,
        result
      });
      return { handled: true, moduleId: moduleDefinition.id, result };
    }

    await this.eventBus?.emit?.("action.unhandled", { action, context });
    return { handled: false, moduleId: null, result: null };
  }
}
