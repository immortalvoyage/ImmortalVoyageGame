import test from "node:test";
import assert from "node:assert/strict";
import { ActionResolver, EventBus, FeatureFlags, ModuleRegistry } from "../src/core/index.js";
import { NARRATIVE_ACTIONS, createNarrativeModule } from "../src/modules/narrative/index.js";

function createResolver(moduleDefinition) {
  const registry = new ModuleRegistry();
  registry.register(moduleDefinition);
  return new ActionResolver({
    moduleRegistry: registry,
    featureFlags: new FeatureFlags({ "module.narrative": true }),
    eventBus: new EventBus()
  });
}

test("Narrative module returns 2 to 4 contextual options", async () => {
  const resolver = createResolver(createNarrativeModule());
  const result = await resolver.resolve({
    type: NARRATIVE_ACTIONS.REQUEST_OPTIONS,
    payload: {
      sceneId: "border-1",
      locationId: "checkpoint",
      summary: "敵國關卡前的守軍已經注意到你。",
      relationship: "hostile",
      danger: "high"
    }
  });

  assert.equal(result.handled, true);
  assert.equal(result.result.options.length, 4);
  assert.equal(result.result.options.some(option => option.intent === "confront"), true);
});

test("Narrative choice is adjudicated instead of directly changing world state", async () => {
  let receivedIntent = null;
  const resolver = createResolver(createNarrativeModule({
    adjudicator: async ({ option }) => {
      receivedIntent = option.intent;
      return { accepted: false, reason: "blocked_by_world_rule", worldChanges: [] };
    }
  }));

  const result = await resolver.resolve({
    type: NARRATIVE_ACTIONS.CHOOSE_OPTION,
    payload: {
      narrativeContext: {
        sceneId: "city-1",
        locationId: "gate",
        summary: "城門已經關閉。"
      },
      option: { id: "enter", label: "強行入城", intent: "force_entry" }
    }
  });

  assert.equal(receivedIntent, "force_entry");
  assert.equal(result.result.outcome.accepted, false);
  assert.deepEqual(result.result.outcome.worldChanges, []);
});
