import test from "node:test";
import assert from "node:assert/strict";
import {
  ActionResolver,
  EventBus,
  FeatureFlags,
  ModuleRegistry,
  WorldClock,
  PERMISSIONS,
  can,
  createSessionContext,
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
  registry.register({ id: "demo", handlers: { LOOK: async ({ action }) => ({ text: action.payload }) } });
  const flags = new FeatureFlags({ "module.demo": true });
  const bus = new EventBus();
  const resolver = new ActionResolver({ moduleRegistry: registry, featureFlags: flags, eventBus: bus });
  const result = await resolver.resolve({ type: "LOOK", payload: "mist" });
  assert.equal(result.handled, true);
  flags.set("module.demo", false);
  assert.equal((await resolver.resolve({ type: "LOOK", payload: "mist" })).handled, false);
});

test("Schema information is versioned", () => {
  assert.deepEqual(getSchemaInfo(), { coreVersion: "0.1.0", worldSchemaVersion: 1, saveSchemaVersion: 1 });
});

test("Session assigns owner privileges only to configured owner", () => {
  const owner = createSessionContext({ userId: "100", characterId: "hero", ownerUserId: "100" });
  const player = createSessionContext({ userId: "200", characterId: "traveler", ownerUserId: "100" });
  assert.equal(owner.player.characterId, "hero");
  assert.equal(can(owner.player, PERMISSIONS.OWNER_CONSOLE), true);
  assert.equal(can(player.player, PERMISSIONS.PLAY), true);
  assert.equal(can(player.player, PERMISSIONS.OWNER_CONSOLE), false);
});
