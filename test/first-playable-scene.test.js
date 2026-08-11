import assert from 'node:assert/strict';
import test from 'node:test';
import { getFirstPlayableScene, resolveFirstPlayableAction } from '../src/core/first-playable-scene.js';

test('coastal birth receives the coastal opening scene', () => {
  const scene = getFirstPlayableScene({ birthRegionTags: ['coast', 'urban'] });
  assert.equal(scene.id, 'birth-coast');
  assert.equal(scene.choices.length, 3);
});

test('forest birth receives the forest opening scene', () => {
  const scene = getFirstPlayableScene({ birthRegionTags: ['forest'] });
  assert.equal(scene.id, 'birth-forest');
});

test('grassland birth falls back to the grassland opening scene', () => {
  const scene = getFirstPlayableScene({ birthRegionTags: ['grassland'] });
  assert.equal(scene.id, 'birth-grassland');
});

test('first scene action resolves without mutating world state', () => {
  const result = resolveFirstPlayableAction({ birthRegionTags: ['coast'] }, 'seek-work');
  assert.equal(result.actionId, 'seek-work');
  assert.equal(result.worldMutation, false);
  assert.ok(result.result.length > 0);
});

test('unknown first scene action is rejected', () => {
  assert.throws(
    () => resolveFirstPlayableAction({ birthRegionTags: ['coast'] }, 'destroy-world'),
    (error) => error?.code === 'unsupported_scene_action',
  );
});
