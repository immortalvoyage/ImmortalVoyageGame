const STARTER_WORK_BY_REGION = Object.freeze({
  coast: Object.freeze([
    Object.freeze({ id: 'dock-cargo', title: '碼頭搬運', professionId: 'laborer', skillId: 'manual_labor', pay: 18, currency: 'copper', provisions: Object.freeze({ food: 'employer', water: 'employer', lodging: 'notProvided' }) }),
    Object.freeze({ id: 'net-mending', title: '漁網修補', professionId: 'fisher-assistant', skillId: 'handcraft', pay: 14, currency: 'copper', provisions: Object.freeze({ food: 'worker', water: 'employer', lodging: 'notProvided' }) }),
  ]),
  forest: Object.freeze([
    Object.freeze({ id: 'timber-haul', title: '木料搬運', professionId: 'laborer', skillId: 'manual_labor', pay: 16, currency: 'copper', provisions: Object.freeze({ food: 'employer', water: 'employer', lodging: 'notProvided' }) }),
    Object.freeze({ id: 'herb-sort', title: '藥草分揀', professionId: 'herbal-assistant', skillId: 'herbalism', pay: 13, currency: 'copper', provisions: Object.freeze({ food: 'worker', water: 'employer', lodging: 'notProvided' }) }),
  ]),
  grassland: Object.freeze([
    Object.freeze({ id: 'herd-help', title: '協助牧群', professionId: 'herder-assistant', skillId: 'animal_care', pay: 15, currency: 'copper', provisions: Object.freeze({ food: 'employer', water: 'employer', lodging: 'shared' }) }),
    Object.freeze({ id: 'cart-loading', title: '車隊裝卸', professionId: 'laborer', skillId: 'manual_labor', pay: 17, currency: 'copper', provisions: Object.freeze({ food: 'worker', water: 'employer', lodging: 'notProvided' }) }),
  ]),
});

function regionKey(character) {
  const tags = Array.isArray(character?.birthRegionTags) ? character.birthRegionTags : [];
  if (tags.includes('coast') || tags.includes('island') || tags.includes('urban')) return 'coast';
  if (tags.includes('forest') || tags.includes('mountain')) return 'forest';
  return 'grassland';
}

function cloneOffer(offer) {
  return Object.freeze({ ...offer, provisions: Object.freeze({ ...offer.provisions }) });
}

export function getStarterWorkOffers(character) {
  return Object.freeze(STARTER_WORK_BY_REGION[regionKey(character)].map(cloneOffer));
}

export function acceptStarterWork(character, workId, { acceptedAt = new Date().toISOString() } = {}) {
  if (!character || typeof character !== 'object') throw new TypeError('character is required');
  if (character.activeWorkContract) {
    const error = new Error('active work contract already exists');
    error.code = 'active_work_exists';
    throw error;
  }
  const offer = getStarterWorkOffers(character).find((item) => item.id === String(workId || ''));
  if (!offer) {
    const error = new Error('unsupported starter work');
    error.code = 'unsupported_starter_work';
    throw error;
  }
  const activeWorkContract = Object.freeze({
    contractId: `starter:${offer.id}`,
    workId: offer.id,
    title: offer.title,
    professionId: offer.professionId,
    skillId: offer.skillId,
    pay: offer.pay,
    currency: offer.currency,
    provisions: offer.provisions,
    status: 'active',
    acceptedAt,
  });
  return Object.freeze({ ...character, activeWorkContract });
}

export function completeStarterWork(character, { completedAt = new Date().toISOString() } = {}) {
  if (!character || typeof character !== 'object') throw new TypeError('character is required');
  const contract = character.activeWorkContract;
  if (!contract || contract.status !== 'active') {
    const error = new Error('no active starter work');
    error.code = 'no_active_work';
    throw error;
  }

  const economy = { ...(character.economy ?? {}) };
  const balances = { ...(economy.balances ?? {}) };
  balances[contract.currency] = (Number(balances[contract.currency]) || 0) + contract.pay;

  const career = { ...(character.career ?? {}) };
  const skills = { ...(career.skills ?? {}) };
  skills[contract.skillId] = (Number(skills[contract.skillId]) || 0) + 1;

  const workHistory = [
    ...(Array.isArray(character.workHistory) ? character.workHistory : []),
    Object.freeze({
      contractId: contract.contractId,
      workId: contract.workId,
      title: contract.title,
      pay: contract.pay,
      currency: contract.currency,
      completedAt,
    }),
  ].slice(-20);

  return Object.freeze({
    ...character,
    economy: Object.freeze({ ...economy, balances: Object.freeze(balances) }),
    career: Object.freeze({ ...career, currentProfessionId: career.currentProfessionId ?? null, skills: Object.freeze(skills) }),
    activeWorkContract: null,
    workHistory: Object.freeze(workHistory),
  });
}
