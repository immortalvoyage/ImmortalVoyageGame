const NEED_KEYS = new Set(['hunger', 'thirst', 'fatigue']);

function fail(message) {
  throw new Error(`invalid content pack: ${message}`);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireRecord(value, path) {
  if (!isRecord(value)) fail(`${path} must be an object`);
  return value;
}

function requireArray(value, path) {
  if (!Array.isArray(value)) fail(`${path} must be an array`);
  return value;
}

function requireText(value, path) {
  if (typeof value !== 'string' || value.trim().length === 0) fail(`${path} must be non-empty text`);
  return value;
}

function requireInteger(value, path, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail(`${path} must be an integer between ${min} and ${max}`);
  return value;
}

function validateNeedMap(value, path, { min, max }) {
  const map = requireRecord(value ?? {}, path);
  for (const [need, amount] of Object.entries(map)) {
    if (!NEED_KEYS.has(need)) fail(`${path}.${need} is not a known need`);
    requireInteger(amount, `${path}.${need}`, { min, max });
  }
}

function assertUnique(values, path) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) fail(`${path} contains duplicate value: ${value}`);
    seen.add(value);
  }
}

export function validateContentPack(pack) {
  requireRecord(pack, 'pack');
  requireText(pack.id, 'pack.id');
  requireInteger(pack.dataVersion, 'pack.dataVersion', { min: 1 });
  requireText(pack.startingLocationId, 'pack.startingLocationId');

  const items = requireRecord(pack.items, 'pack.items');
  const locations = requireRecord(pack.locations, 'pack.locations');
  const npcs = requireRecord(pack.npcs, 'pack.npcs');

  if (Object.keys(items).length === 0) fail('pack.items must not be empty');
  if (Object.keys(locations).length === 0) fail('pack.locations must not be empty');
  if (!locations[pack.startingLocationId]) fail(`starting location does not exist: ${pack.startingLocationId}`);

  for (const [itemId, item] of Object.entries(items)) {
    requireText(itemId, 'item id');
    requireRecord(item, `items.${itemId}`);
    requireText(item.name, `items.${itemId}.name`);
    if (item.consumeLabel !== undefined) requireText(item.consumeLabel, `items.${itemId}.consumeLabel`);
    if (item.consumeEffect !== undefined) validateNeedMap(item.consumeEffect, `items.${itemId}.consumeEffect`, { min: -100, max: 100 });
  }

  for (const [locationId, location] of Object.entries(locations)) {
    requireText(locationId, 'location id');
    requireRecord(location, `locations.${locationId}`);
    requireText(location.name, `locations.${locationId}.name`);
    requireText(location.description, `locations.${locationId}.description`);

    const routes = requireArray(location.routes, `locations.${locationId}.routes`);
    assertUnique(routes, `locations.${locationId}.routes`);
    for (const destinationId of routes) {
      requireText(destinationId, `locations.${locationId}.routes[]`);
      if (destinationId === locationId) fail(`locations.${locationId}.routes cannot target itself`);
      if (!locations[destinationId]) fail(`locations.${locationId}.routes targets unknown location: ${destinationId}`);
    }

    const jobs = requireArray(location.jobs, `locations.${locationId}.jobs`);
    assertUnique(jobs.map((job) => job?.id), `locations.${locationId}.jobs ids`);
    for (const [index, job] of jobs.entries()) {
      const path = `locations.${locationId}.jobs[${index}]`;
      requireRecord(job, path);
      requireText(job.id, `${path}.id`);
      requireText(job.label, `${path}.label`);
      requireInteger(job.rewardMoney, `${path}.rewardMoney`, { min: 0 });
      validateNeedMap(job.needCosts, `${path}.needCosts`, { min: 0, max: 100 });
    }

    const market = requireArray(location.market, `locations.${locationId}.market`);
    assertUnique(market.map((offer) => offer?.itemId), `locations.${locationId}.market item ids`);
    for (const [index, offer] of market.entries()) {
      const path = `locations.${locationId}.market[${index}]`;
      requireRecord(offer, path);
      requireText(offer.itemId, `${path}.itemId`);
      if (!items[offer.itemId]) fail(`${path}.itemId references unknown item: ${offer.itemId}`);
      requireInteger(offer.price, `${path}.price`, { min: 0 });
    }

    const gatherables = requireArray(location.gatherables, `locations.${locationId}.gatherables`);
    assertUnique(gatherables.map((entry) => entry?.itemId), `locations.${locationId}.gatherables item ids`);
    for (const [index, gatherable] of gatherables.entries()) {
      const path = `locations.${locationId}.gatherables[${index}]`;
      requireRecord(gatherable, path);
      requireText(gatherable.itemId, `${path}.itemId`);
      if (!items[gatherable.itemId]) fail(`${path}.itemId references unknown item: ${gatherable.itemId}`);
      requireInteger(gatherable.quantity, `${path}.quantity`, { min: 1 });
      requireText(gatherable.label, `${path}.label`);
    }
  }

  for (const [npcId, npc] of Object.entries(npcs)) {
    requireText(npcId, 'npc id');
    requireRecord(npc, `npcs.${npcId}`);
    requireText(npc.name, `npcs.${npcId}.name`);
    requireText(npc.locationId, `npcs.${npcId}.locationId`);
    if (!locations[npc.locationId]) fail(`npcs.${npcId}.locationId references unknown location: ${npc.locationId}`);
    requireText(npc.greeting, `npcs.${npcId}.greeting`);
    if (npc.searchLabel !== undefined) requireText(npc.searchLabel, `npcs.${npcId}.searchLabel`);
  }

  return pack;
}
