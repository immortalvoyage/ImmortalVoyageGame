import test from "node:test";
import assert from "node:assert/strict";
import {
  ActionResolver,
  EventBus,
  FeatureFlags,
  ModuleRegistry,
  WorldClock,
  getSchemaInfo
} from "../src/core/index.js";

test("WorldClock converts real time into world days", () => {
  const clock = new WorldClock({ epochMs: 0, realMsPerWorldDay: 1000 });
  assert.equal(clock.getWorldDay(2500), 2);
  assert.equal(clock.snapshot(2500).dayProgress, 0.5);
});

test("EventBus publishes events", async () => {
  const bus = new EventBus();
  let received = null;
  bus.on("world.changed", payload => { received = payload; });
  await bus.emit("world.changed", { id: 1 });
  assert.deepEqual(received, { id: 1 });
});

test("ActionResolver routes actions only to enabled modules", async () => {
  const registry = new ModuleRegistry();
  registry.register({
    id: "demo",
    handlers: {
      LOOK: async ({ action }) => ({ text: action.payload })
    }
  });
  const flags = new FeatureFlags({ "module.demo": true });
  const bus = new EventBus();
  const resolver = new ActionResolver({ moduleRegistry: registry, featureFlags: flags, eventBus: bus });

  const result = await resolver.resolve({ type: "LOOK", payload: "mist" });
  assert.equal(result.handled, true);
  assert.equal(result.moduleId, "demo");
  assert.deepEqual(result.result, { text: "mist" });

  flags.set("module.demo", false);
  const disabled = await resolver.resolve({ type: "LOOK", payload: "mist" });
  assert.equal(disabled.handled, false);
});

test("Schema information is versioned", () => {
  assert.deepEqual(getSchemaInfo(), {
    coreVersion: "0.1.0",
    worldSchemaVersion: 1,
    saveSchemaVersion: 1
  });
});
