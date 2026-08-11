import assert from 'node:assert/strict';
import test from 'node:test';
import { ACTION_HISTORY_LIMIT, applyFirstPlayableAction, getFirstPlayableScene, resolveFirstPlayableAction } from '../src/core/first-playable-scene.js';

test('coastal birth receives the coastal opening scene and starter gathering action', () => {
  const scene = getFirstPlayableScene({ birthRegionTags: ['coast', 'urban'] });
  assert.equal(scene.id, 'birth-coast');
  assert.equal(scene.choices.length, 4);
  assert.equal(scene.choices.some((choice) => choice.id === 'starter-gather'), true);
});

test('forest birth receives the forest opening scene', () => {
  const scene = getFirstPlayableScene({ birthRegionTags: ['forest'] });
  assert.equal(scene.id, 'birth-forest');
});

test('grassland birth falls back to the grassland opening scene', () => {
  const scene = getFirstPlayableScene({ birthRegionTags: ['grassland'] });
  assert.equal(scene.id, 'birth-grassland');
});

test('world progress unlocks a region-specific follow-up choice', () => {
  const scene = getFirstPlayableScene({ birthRegionTags: ['forest'], worldProgress: { locationKnowledge: 2 } });
  assert.equal(scene.choices.length, 5);
  assert.equal(scene.choices.at(-1).id, 'read-forest-signs');
});

test('locked follow-up action cannot be submitted before its requirement is met', () => {
  assert.throws(() => resolveFirstPlayableAction({ birthRegionTags: ['forest'], worldProgress: { locationKnowledge: 1 } }, 'read-forest-signs'), (error) => error?.code === 'unsupported_scene_action');
});

test('unlocked follow-up action adds route confidence without mutating shared world state', () => {
  const result = resolveFirstPlayableAction({ birthRegionTags: ['forest'], worldProgress: { locationKnowledge: 2 } }, 'read-forest-signs');
  assert.equal(result.progress.routeConfidence, 1);
  assert.equal(result.worldMutation, false);
});

test('first scene action resolves without mutating shared world state', () => {
  const result = resolveFirstPlayableAction({ birthRegionTags: ['coast'] }, 'seek-work');
  assert.equal(result.actionId, 'seek-work');
  assert.equal(result.worldMutation, false);
  assert.equal(result.progress.settlementContact, 1);
  assert.ok(result.result.length > 0);
});

test('unknown first scene action is rejected', () => {
  assert.throws(() => resolveFirstPlayableAction({ birthRegionTags: ['coast'] }, 'destroy-world'), (error) => error?.code === 'unsupported_scene_action');
});

test('applying an action stores scene state, world progress and action history on the character', () => {
  const original = { characterId: 'char-1', playerId: 'player-1', birthRegionTags: ['coast'], status: 'alive' };
  const applied = applyFirstPlayableAction(original, 'observe', { occurredAt: '2026-08-11T03:00:00.000Z' });

  assert.equal(original.sceneState, undefined);
  assert.equal(original.worldProgress, undefined);
  assert.equal(applied.character.sceneState.sceneId, 'birth-coast');
  assert.equal(applied.character.sceneState.lastActionId, 'observe');
  assert.equal(applied.character.worldProgress.awareness, 1);
  assert.equal(applied.character.worldProgress.locationKnowledge, 1);
  assert.equal(applied.character.actionHistory.length, 1);
  assert.equal(applied.character.actionHistory[0].occurredAt, '2026-08-11T03:00:00.000Z');
  assert.equal(applied.character.actionHistory[0].worldMutation, false);
});

test('starter gathering enters inventory through the existing scene action flow and then disappears', () => {
  const original = { characterId: 'char-1', playerId: 'player-1', birthRegionId: 'starter-forest', birthRegionTags: ['forest'], status: 'alive' };
  const applied = applyFirstPlayableAction(original, 'starter-gather', { occurredAt: '2026-08-11T03:02:00.000Z' });
  assert.equal(applied.character.inventory.items[0].itemId, 'wild-berry');
  assert.equal(applied.character.sceneState.lastActionId, 'starter-gather');
  assert.equal(getFirstPlayableScene(applied.character).choices.some((choice) => choice.id === 'starter-gather'), false);
});

test('repeated world actions accumulate character progress', () => {
  const original = { characterId: 'char-1', playerId: 'player-1', birthRegionTags: ['forest'], status: 'alive' };
  const first = applyFirstPlayableAction(original, 'explore', { occurredAt: '2026-08-11T03:00:00.000Z' }).character;
  const second = applyFirstPlayableAction(first, 'observe', { occurredAt: '2026-08-11T03:05:00.000Z' }).character;
  assert.equal(second.worldProgress.exploration, 1);
  assert.equal(second.worldProgress.awareness, 1);
  assert.equal(second.worldProgress.locationKnowledge, 2);
});

test('action history is bounded to prevent character payload from growing forever', () => {
  let character = { characterId: 'char-1', playerId: 'player-1', birthRegionTags: ['forest'], status: 'alive' };
  for (let index = 0; index < ACTION_HISTORY_LIMIT + 5; index += 1) {
    character = applyFirstPlayableAction(character, 'observe', { occurredAt: `2026-08-11T03:${String(index).padStart(2, '0')}:00.000Z` }).character;
  }
  assert.equal(character.actionHistory.length, ACTION_HISTORY_LIMIT);
  assert.equal(character.actionHistory.at(-1).sceneId, 'birth-forest');
  assert.equal(character.worldProgress.awareness, ACTION_HISTORY_LIMIT + 5);
});
