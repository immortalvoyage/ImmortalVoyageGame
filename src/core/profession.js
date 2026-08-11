const DEFAULT_WORLD_CAPABILITIES = Object.freeze(new Set(['manual_craft','sailing','commerce','agriculture','medicine','religion','military','services']));

function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${field} is required`);
  return value.trim();
}

function normalizeList(value) {
  return Object.freeze([...(Array.isArray(value) ? value : [])].map((item) => requireText(item, 'list item')));
}

export function createProfessionDefinition({ id, name, skills = [], incomeMethods = [], tools = [], places = [], capabilities = [] }) {
  return Object.freeze({
    id: requireText(id, 'id'),
    name: requireText(name, 'name'),
    skills: normalizeList(skills),
    incomeMethods: normalizeList(incomeMethods),
    tools: normalizeList(tools),
    places: normalizeList(places),
    capabilities: normalizeList(capabilities),
  });
}

export function setCurrentProfession(characterCareer, professionId) {
  return Object.freeze({
    ...(characterCareer ?? {}),
    currentProfessionId: professionId ? requireText(professionId, 'professionId') : null,
    skills: Object.freeze({ ...(characterCareer?.skills ?? {}) }),
    qualifications: Object.freeze([...(characterCareer?.qualifications ?? [])]),
  });
}

export function addSkillProgress(characterCareer, skillId, amount = 1) {
  const id = requireText(skillId, 'skillId');
  const delta = Number(amount);
  if (!Number.isFinite(delta) || delta <= 0) throw new TypeError('amount must be positive');
  const skills = { ...(characterCareer?.skills ?? {}) };
  skills[id] = (Number(skills[id]) || 0) + delta;
  return Object.freeze({ ...(characterCareer ?? {}), skills: Object.freeze(skills) });
}

export function evaluateProfessionCandidate(candidate, { existingProfessions = [], worldCapabilities = DEFAULT_WORLD_CAPABILITIES, minimumEvidenceCount = 3 } = {}) {
  const definition = createProfessionDefinition(candidate);
  const evidence = Array.isArray(candidate?.evidence) ? candidate.evidence : [];
  if (evidence.length < minimumEvidenceCount) return Object.freeze({ accepted: false, reason: 'insufficient_longitudinal_evidence' });

  const supportedCapabilities = worldCapabilities instanceof Set ? worldCapabilities : new Set(worldCapabilities ?? []);
  if (definition.capabilities.some((capability) => !supportedCapabilities.has(capability))) {
    return Object.freeze({ accepted: false, reason: 'world_era_incompatible' });
  }

  const normalizedSkills = [...definition.skills].sort().join('|');
  const normalizedIncome = [...definition.incomeMethods].sort().join('|');
  const duplicate = existingProfessions.find((profession) => {
    const known = createProfessionDefinition(profession);
    return [...known.skills].sort().join('|') === normalizedSkills && [...known.incomeMethods].sort().join('|') === normalizedIncome;
  });
  if (duplicate) return Object.freeze({ accepted: false, reason: 'equivalent_existing_profession', equivalentProfessionId: duplicate.id });

  if (!definition.skills.length || !definition.incomeMethods.length) {
    return Object.freeze({ accepted: false, reason: 'incomplete_operation_model' });
  }

  return Object.freeze({ accepted: true, reason: 'candidate_valid', profession: definition });
}

export function createProfessionDiscoveryAnnouncement({ professionName, pioneerName }) {
  return Object.freeze({
    title: '世間出現了新的行當',
    professionName: requireText(professionName, 'professionName'),
    pioneerName: requireText(pioneerName, 'pioneerName'),
    discloseUnlockConditions: false,
  });
}
