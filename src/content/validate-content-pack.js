const NEED_KEYS = new Set(['hunger', 'thirst', 'fatigue']);
const PROGRESSION_KINDS = new Set(['skill', 'social']);
const MAX_ROUTE_TRAVEL_SECONDS = 30 * 24 * 60 * 60;

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
  if (value === undefined) return;
  const map = requireRecord(value, path);
  for (const [need, amount] of Object.entries(map)) {
    if (!NEED_KEYS.has(need)) fail(`${path}.${need} is not a known need`);
    requireInteger(amount, `${path}.${need}`, { min, max });
  }
}

function rememberUnique(seen, value, path) {
  if (seen.has(value)) fail(`${path} contains duplicate value: ${value}`);
  seen.add(value);
}

function validateItemQuantity(entry, path, items) {
  requireRecord(entry, path);
  requireText(entry.itemId, `${path}.itemId`);
  if (!Object.hasOwn(items, entry.itemId)) fail(`${path}.itemId references unknown item: ${entry.itemId}`);
  requireInteger(entry.quantity, `${path}.quantity`, { min: 1 });
}

function validateBehaviorRequirements(requirements, path, declaredBehaviorIds) {
  requireArray(requirements, path);
  if (requirements.length === 0) fail(`${path} must not be empty`);
  const requirementBehaviorIds = new Set();
  for (const [index, requirement] of requirements.entries()) {
    const requirementPath = `${path}[${index}]`;
    requireRecord(requirement, requirementPath);
    requireText(requirement.behaviorId, `${requirementPath}.behaviorId`);
    rememberUnique(requirementBehaviorIds, requirement.behaviorId, `${path} behavior ids`);
    if (!declaredBehaviorIds.has(requirement.behaviorId)) {
      fail(`${requirementPath}.behaviorId references unknown behavior: ${requirement.behaviorId}`);
    }
    requireInteger(requirement.minCount, `${requirementPath}.minCount`, { min: 1 });
  }
}

function validateNpcRelationship(npc, path, declaredBehaviorIds, knowledge) {
  if (npc.relationship === undefined) return;
  const relationship = requireRecord(npc.relationship, `${path}.relationship`);
  const behaviorId = requireText(relationship.behaviorId, `${path}.relationship.behaviorId`);
  if (declaredBehaviorIds.has(behaviorId)) fail(`${path}.relationship.behaviorId must be unique: ${behaviorId}`);
  declaredBehaviorIds.add(behaviorId);

  const levels = requireArray(relationship.levels, `${path}.relationship.levels`);
  if (levels.length === 0) fail(`${path}.relationship.levels must not be empty`);
  let previousMinCount = 0;
  const names = new Set();
  const topicIds = new Set();
  for (const [index, level] of levels.entries()) {
    const levelPath = `${path}.relationship.levels[${index}]`;
    requireRecord(level, levelPath);
    const name = requireText(level.name, `${levelPath}.name`);
    rememberUnique(names, name, `${path}.relationship.level names`);
    const minCount = requireInteger(level.minCount, `${levelPath}.minCount`, { min: 1 });
    if (minCount <= previousMinCount) fail(`${path}.relationship.levels must have strictly increasing minCount`);
    if (level.responseText !== undefined) requireText(level.responseText, `${levelPath}.responseText`);
    if (level.topics !== undefined) {
      const topics = requireArray(level.topics, `${levelPath}.topics`);
      for (const [topicIndex, topic] of topics.entries()) {
        const topicPath = `${levelPath}.topics[${topicIndex}]`;
        requireRecord(topic, topicPath);
        const topicId = requireText(topic.id, `${topicPath}.id`);
        rememberUnique(topicIds, topicId, `${path}.relationship topic ids`);
        requireText(topic.label, `${topicPath}.label`);
        requireText(topic.responseText, `${topicPath}.responseText`);
        if (topic.grantsKnowledgeIds !== undefined) {
          const grantsKnowledgeIds = requireArray(topic.grantsKnowledgeIds, `${topicPath}.grantsKnowledgeIds`);
          if (grantsKnowledgeIds.length === 0) fail(`${topicPath}.grantsKnowledgeIds must not be empty`);
          const grantedIds = new Set();
          for (const [grantIndex, knowledgeId] of grantsKnowledgeIds.entries()) {
            const grantPath = `${topicPath}.grantsKnowledgeIds[${grantIndex}]`;
            requireText(knowledgeId, grantPath);
            rememberUnique(grantedIds, knowledgeId, `${topicPath}.grantsKnowledgeIds`);
            if (!Object.hasOwn(knowledge, knowledgeId)) fail(`${grantPath} references unknown knowledge: ${knowledgeId}`);
          }
        }
      }
    }
    previousMinCount = minCount;
  }
}

export function validateContentPack(pack) {
  requireRecord(pack, 'pack');
  requireText(pack.id, 'pack.id');
  requireInteger(pack.dataVersion, 'pack.dataVersion', { min: 1 });
  requireText(pack.startingLocationId, 'pack.startingLocationId');

  const survival = requireRecord(pack.survival, 'pack.survival');
  const warningThreshold = requireInteger(survival.warningThreshold, 'pack.survival.warningThreshold', { min: 1, max: 99 });
  const criticalThreshold = requireInteger(survival.criticalThreshold, 'pack.survival.criticalThreshold', { min: 2, max: 100 });
  requireInteger(survival.restFatigueRelief, 'pack.survival.restFatigueRelief', { min: 1, max: 100 });
  if (warningThreshold >= criticalThreshold) fail('pack.survival.warningThreshold must be lower than criticalThreshold');

  const items = requireRecord(pack.items, 'pack.items');
  const locations = requireRecord(pack.locations, 'pack.locations');
  const progressionTags = requireRecord(pack.progressionTags, 'pack.progressionTags');
  const careers = requireRecord(pack.careers, 'pack.careers');
  const knowledge = requireRecord(pack.knowledge, 'pack.knowledge');
  const npcs = requireRecord(pack.npcs, 'pack.npcs');

  if (Object.keys(items).length === 0) fail('pack.items must not be empty');
  if (Object.keys(locations).length === 0) fail('pack.locations must not be empty');
  if (!Object.hasOwn(locations, pack.startingLocationId)) fail(`starting location does not exist: ${pack.startingLocationId}`);

  for (const [itemId, item] of Object.entries(items)) {
    requireText(itemId, 'item id');
    requireRecord(item, `items.${itemId}`);
    requireText(item.name, `items.${itemId}.name`);
    if (item.consumeLabel !== undefined) requireText(item.consumeLabel, `items.${itemId}.consumeLabel`);
    validateNeedMap(item.consumeEffect, `items.${itemId}.consumeEffect`, { min: -100, max: 100 });
  }

  for (const [knowledgeId, fact] of Object.entries(knowledge)) {
    requireText(knowledgeId, 'knowledge id');
    const path = `knowledge.${knowledgeId}`;
    requireRecord(fact, path);
    requireText(fact.name, `${path}.name`);
    if (fact.revealsNpcIds !== undefined) {
      const revealsNpcIds = requireArray(fact.revealsNpcIds, `${path}.revealsNpcIds`);
      if (revealsNpcIds.length === 0) fail(`${path}.revealsNpcIds must not be empty`);
      const revealedNpcIds = new Set();
      for (const [index, npcId] of revealsNpcIds.entries()) {
        const revealPath = `${path}.revealsNpcIds[${index}]`;
        requireText(npcId, revealPath);
        rememberUnique(revealedNpcIds, npcId, `${path}.revealsNpcIds`);
        if (!Object.hasOwn(npcs, npcId)) fail(`${revealPath} references unknown npc: ${npcId}`);
      }
    }
  }

  const declaredBehaviorIds = new Set();
  for (const [locationId, location] of Object.entries(locations)) {
    requireText(locationId, 'location id');
    requireRecord(location, `locations.${locationId}`);
    requireText(location.name, `locations.${locationId}.name`);
    requireText(location.description, `locations.${locationId}.description`);

    const routes = requireArray(location.routes, `locations.${locationId}.routes`);
    const routeIds = new Set();
    for (const [index, route] of routes.entries()) {
      const routePath = `locations.${locationId}.routes[${index}]`;
      requireRecord(route, routePath);
      const destinationId = requireText(route.destinationId, `${routePath}.destinationId`);
      rememberUnique(routeIds, destinationId, `locations.${locationId}.routes destination ids`);
      if (destinationId === locationId) fail(`locations.${locationId}.routes cannot target itself`);
      if (!Object.hasOwn(locations, destinationId)) fail(`locations.${locationId}.routes targets unknown location: ${destinationId}`);
      requireInteger(route.travelSeconds, `${routePath}.travelSeconds`, { min: 1, max: MAX_ROUTE_TRAVEL_SECONDS });
      requireRecord(route.needCosts, `${routePath}.needCosts`);
      validateNeedMap(route.needCosts, `${routePath}.needCosts`, { min: 0, max: 100 });
    }

    const jobs = requireArray(location.jobs, `locations.${locationId}.jobs`);
    const jobIds = new Set();
    for (const [index, job] of jobs.entries()) {
      const path = `locations.${locationId}.jobs[${index}]`;
      requireRecord(job, path);
      requireText(job.id, `${path}.id`);
      rememberUnique(jobIds, job.id, `locations.${locationId}.jobs ids`);
      requireText(job.label, `${path}.label`);
      requireText(job.behaviorId, `${path}.behaviorId`);
      declaredBehaviorIds.add(job.behaviorId);
      requireInteger(job.rewardMoney, `${path}.rewardMoney`, { min: 0 });
      validateNeedMap(job.needCosts, `${path}.needCosts`, { min: 0, max: 100 });
    }

    const market = requireArray(location.market, `locations.${locationId}.market`);
    const marketItemIds = new Set();
    for (const [index, offer] of market.entries()) {
      const path = `locations.${locationId}.market[${index}]`;
      requireRecord(offer, path);
      requireText(offer.itemId, `${path}.itemId`);
      rememberUnique(marketItemIds, offer.itemId, `locations.${locationId}.market item ids`);
      if (!Object.hasOwn(items, offer.itemId)) fail(`${path}.itemId references unknown item: ${offer.itemId}`);
      requireInteger(offer.price, `${path}.price`, { min: 0 });
    }

    const gatherables = requireArray(location.gatherables, `locations.${locationId}.gatherables`);
    const gatherableItemIds = new Set();
    for (const [index, gatherable] of gatherables.entries()) {
      const path = `locations.${locationId}.gatherables[${index}]`;
      validateItemQuantity(gatherable, path, items);
      rememberUnique(gatherableItemIds, gatherable.itemId, `locations.${locationId}.gatherables item ids`);
      requireText(gatherable.label, `${path}.label`);
      requireText(gatherable.behaviorId, `${path}.behaviorId`);
      declaredBehaviorIds.add(gatherable.behaviorId);
    }

    const recipes = requireArray(location.recipes, `locations.${locationId}.recipes`);
    const recipeIds = new Set();
    for (const [index, recipe] of recipes.entries()) {
      const path = `locations.${locationId}.recipes[${index}]`;
      requireRecord(recipe, path);
      requireText(recipe.id, `${path}.id`);
      rememberUnique(recipeIds, recipe.id, `locations.${locationId}.recipes ids`);
      requireText(recipe.label, `${path}.label`);
      requireText(recipe.behaviorId, `${path}.behaviorId`);
      declaredBehaviorIds.add(recipe.behaviorId);

      const inputs = requireArray(recipe.inputs, `${path}.inputs`);
      if (inputs.length === 0) fail(`${path}.inputs must not be empty`);
      const inputItemIds = new Set();
      for (const [inputIndex, input] of inputs.entries()) {
        const inputPath = `${path}.inputs[${inputIndex}]`;
        validateItemQuantity(input, inputPath, items);
        rememberUnique(inputItemIds, input.itemId, `${path}.inputs item ids`);
      }
      validateItemQuantity(recipe.output, `${path}.output`, items);
    }
  }

  for (const [npcId, npc] of Object.entries(npcs)) {
    requireText(npcId, 'npc id');
    const path = `npcs.${npcId}`;
    requireRecord(npc, path);
    requireText(npc.name, `${path}.name`);
    requireText(npc.locationId, `${path}.locationId`);
    if (!Object.hasOwn(locations, npc.locationId)) fail(`${path}.locationId references unknown location: ${npc.locationId}`);
    requireText(npc.greeting, `${path}.greeting`);
    if (npc.searchLabel !== undefined) requireText(npc.searchLabel, `${path}.searchLabel`);
    if (npc.knownAtStart !== undefined && typeof npc.knownAtStart !== 'boolean') {
      fail(`${path}.knownAtStart must be boolean`);
    }
    validateNpcRelationship(npc, path, declaredBehaviorIds, knowledge);
  }

  for (const [tagId, tag] of Object.entries(progressionTags)) {
    requireText(tagId, 'progression tag id');
    const path = `progressionTags.${tagId}`;
    requireRecord(tag, path);
    requireText(tag.name, `${path}.name`);
    if (!PROGRESSION_KINDS.has(tag.kind)) fail(`${path}.kind must be skill or social`);
    validateBehaviorRequirements(tag.requirements, `${path}.requirements`, declaredBehaviorIds);
  }

  for (const [careerId, career] of Object.entries(careers)) {
    requireText(careerId, 'career id');
    const path = `careers.${careerId}`;
    requireRecord(career, path);
    requireText(career.name, `${path}.name`);
    validateBehaviorRequirements(career.requirements, `${path}.requirements`, declaredBehaviorIds);
  }

  return pack;
}
