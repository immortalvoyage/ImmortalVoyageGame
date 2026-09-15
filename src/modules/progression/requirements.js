export function behaviorRequirementsMet(character, requirements = []) {
  return requirements.every(
    (requirement) => (character?.behaviorCounts?.[requirement.behaviorId] ?? 0) >= requirement.minCount,
  );
}

export function jobRequirementsMet(character, job) {
  return !job?.requirements || behaviorRequirementsMet(character, job.requirements);
}
