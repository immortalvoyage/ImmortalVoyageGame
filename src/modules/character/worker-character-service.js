import { createD1CharacterRepository } from './d1-character-repository.js';
import { createPlayerCharacterBootstrap } from './player-character-bootstrap.js';
import { createCharacterFromBirth } from './character-creation.js';

const DEFAULT_BIRTH_REGIONS = Object.freeze([
  Object.freeze({ id: 'starter-coast', tags: ['coast', 'urban'], weight: 1, active: true, birthAllowed: true }),
  Object.freeze({ id: 'starter-forest', tags: ['forest'], weight: 1, active: true, birthAllowed: true }),
  Object.freeze({ id: 'starter-grassland', tags: ['grassland'], weight: 1, active: true, birthAllowed: true }),
]);

export function createWorkerCharacterService(env, { regions = DEFAULT_BIRTH_REGIONS, random = Math.random } = {}) {
  if (!env?.DB) throw new TypeError('DB binding is required');
  const repository = createD1CharacterRepository(env.DB);
  const bootstrap = createPlayerCharacterBootstrap({
    repository,
    createCharacter: (input) => createCharacterFromBirth({
      ...input,
      characterId: input.characterId ?? crypto.randomUUID(),
      regions,
      random,
    }),
  });

  return Object.freeze({
    resolve: (playerId) => bootstrap.resolve({ playerId }),
    create: (playerId, createInput) => bootstrap.resolve({ playerId, createInput }),
    save: (character) => repository.save(character),
  });
}

export { DEFAULT_BIRTH_REGIONS };
