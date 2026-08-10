function pickWeighted(entries, random = Math.random) {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = random() * total;
  for (const entry of entries) {
    cursor -= entry.weight;
    if (cursor < 0) return entry;
  }
  return entries.at(-1);
}

const TALENTS = Object.freeze([
  { id: 'hardy', name: '強健', weight: 10, tags: ['general'], modifiers: { constitutionChecks: 1 } },
  { id: 'keen-senses', name: '敏銳', weight: 10, tags: ['general'], modifiers: { perceptionChecks: 1 } },
  { id: 'heat-adapted', name: '耐熱', weight: 3, tags: ['desert'], modifiers: { heatStress: 0.85 } },
  { id: 'drought-adapted', name: '耐旱', weight: 2, tags: ['desert'], modifiers: { thirstRate: 0.8 } },
  { id: 'cold-adapted', name: '耐寒', weight: 3, tags: ['cold'], modifiers: { coldStress: 0.85 } },
  { id: 'sea-legs', name: '慣海', weight: 3, tags: ['island', 'coast'], modifiers: { seasicknessChecks: 1 } },
  { id: 'natural-swimmer', name: '善水', weight: 2, tags: ['island', 'coast'], modifiers: { swimmingChecks: 1 } },
]);

export function rollBirthTalents({ regionTags = [], count = 1, random = Math.random } = {}) {
  const wanted = Math.max(0, Math.min(3, Number(count) || 0));
  const pool = TALENTS.map((talent) => {
    const regionBoost = talent.tags.some((tag) => regionTags.includes(tag)) ? 4 : 1;
    return { ...talent, weight: talent.weight * regionBoost };
  });

  const selected = [];
  const available = [...pool];
  while (selected.length < wanted && available.length) {
    const talent = pickWeighted(available, random);
    selected.push(Object.freeze({ id: talent.id, name: talent.name, modifiers: Object.freeze({ ...talent.modifiers }) }));
    available.splice(available.findIndex((entry) => entry.id === talent.id), 1);
  }
  return Object.freeze(selected);
}

export { TALENTS };
