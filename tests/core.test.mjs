import test from "node:test";
import assert from "node:assert/strict";
import {
  ActionResolver,
  EventBus,
  FeatureFlags,
  ModuleRegistry,
  WorldClock,
  PERMISSIONS,
  TESTER_ACCESS_SOURCES,
  TURN_SOURCES,
  TurnLedger,
  can,
  createSessionContext,
  createTesterAccess,
  getSchemaInfo,
  hasTesterAccess
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

test("Tester access supports sponsor access, expiry and owner bypass", () => {
  const owner = createSessionContext({ userId: "100", ownerUserId: "100" });
  const player = createSessionContext({ userId: "200", ownerUserId: "100" });
  const sponsor = createTesterAccess({ userId: "200", source: TESTER_ACCESS_SOURCES.SPONSOR, expiresAt: 5000 });
  assert.equal(hasTesterAccess(player.player, sponsor, 4000), true);
  assert.equal(hasTesterAccess(player.player, sponsor, 5000), false);
  assert.equal(hasTesterAccess(owner.player, null, 5000), true);
});

test("TurnLedger resets free turns and consumes non-paid balances first", () => {
  const ledger = new TurnLedger({ userId: "200" });
  ledger.setDailyFree(3, { at: 1000 });
  ledger.grant(TURN_SOURCES.REWARDED_AD, 2, { reason: "rewarded_ad", at: 1100 });
  ledger.grant(TURN_SOURCES.PURCHASED, 5, { reason: "purchase", at: 1200 });

  const first = ledger.consume(4, { at: 1300 });
  assert.equal(first.ok, true);
  assert.deepEqual(first.breakdown, { free_daily: 3, rewarded_ad: 1 });
  assert.equal(ledger.balance(TURN_SOURCES.PURCHASED), 5);
  assert.equal(ledger.total(), 6);

  ledger.setDailyFree(3, { at: 2000 });
  assert.equal(ledger.balance(TURN_SOURCES.FREE_DAILY), 3);
  assert.equal(ledger.total(), 9);
});
