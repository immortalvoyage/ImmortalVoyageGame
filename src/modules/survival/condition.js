const NEED_LABELS = Object.freeze({
  hunger: '飢餓',
  thirst: '口渴',
  fatigue: '疲勞',
});

function orderedNeedEntries(needs = {}) {
  return Object.keys(NEED_LABELS).map((need) => ({
    need,
    name: NEED_LABELS[need],
    value: needs[need] ?? 0,
  }));
}

export function evaluateSurvivalCondition(character, policy) {
  const warningThreshold = policy?.warningThreshold;
  const criticalThreshold = policy?.criticalThreshold;
  if (!Number.isSafeInteger(warningThreshold) || !Number.isSafeInteger(criticalThreshold)) {
    throw new Error('invalid survival condition policy');
  }

  const entries = orderedNeedEntries(character?.needs);
  const criticalNeeds = entries.filter((entry) => entry.value >= criticalThreshold);
  const warningNeeds = entries.filter((entry) => entry.value >= warningThreshold && entry.value < criticalThreshold);
  return {
    severity: criticalNeeds.length > 0 ? 'critical' : warningNeeds.length > 0 ? 'warning' : 'normal',
    warningNeeds,
    criticalNeeds,
  };
}

export function buildPublicSurvivalCondition(character, policy) {
  const condition = evaluateSurvivalCondition(character, policy);
  return {
    severity: condition.severity,
    warningNeeds: condition.warningNeeds.map(({ name, value }) => ({ name, value })),
    criticalNeeds: condition.criticalNeeds.map(({ name, value }) => ({ name, value })),
  };
}

export function canPerformSurvivalLimitedWork(character, policy) {
  return evaluateSurvivalCondition(character, policy).severity !== 'critical';
}
