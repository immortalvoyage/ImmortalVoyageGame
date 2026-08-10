function requireFinite(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${field} must be a number`);
  return number;
}

function rollD20(random = Math.random) {
  return Math.floor(random() * 20) + 1;
}

export function resolveDiceCheck({ difficulty, modifier = 0, advantage = false, disadvantage = false, random = Math.random }) {
  const dc = Math.max(1, Math.floor(requireFinite(difficulty, 'difficulty')));
  const bonus = requireFinite(modifier, 'modifier');

  const first = rollD20(random);
  let second = null;
  let natural = first;

  if (advantage !== disadvantage && (advantage || disadvantage)) {
    second = rollD20(random);
    natural = advantage ? Math.max(first, second) : Math.min(first, second);
  }

  const total = natural + bonus;
  return Object.freeze({
    natural,
    rolls: Object.freeze(second === null ? [first] : [first, second]),
    modifier: bonus,
    total,
    difficulty: dc,
    success: total >= dc,
    criticalSuccess: natural === 20,
    criticalFailure: natural === 1,
  });
}

export function resolveOpposedCheck({ attackerModifier = 0, defenderModifier = 0, attackerRandom = Math.random, defenderRandom = Math.random }) {
  const attacker = resolveDiceCheck({ difficulty: 1, modifier: attackerModifier, random: attackerRandom });
  const defender = resolveDiceCheck({ difficulty: 1, modifier: defenderModifier, random: defenderRandom });
  return Object.freeze({
    attacker,
    defender,
    winner: attacker.total === defender.total ? 'tie' : attacker.total > defender.total ? 'attacker' : 'defender',
  });
}
