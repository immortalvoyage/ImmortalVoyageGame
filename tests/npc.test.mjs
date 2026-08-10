import assert from 'node:assert/strict';
import test from 'node:test';
import { NpcRegistry, resolveFindNpc } from '../src/modules/npc/index.js';

test('find NPC does not reveal unknown real location', () => {
  const npcs = new NpcRegistry();
  npcs.registerNpc({ id: 'npc-liuqing', name: '柳青', locationId: 'north-hill' });

  const result = resolveFindNpc({ npcRegistry: npcs, npcName: '柳青', knownLocations: [], currentLocationId: 'qinghe-city' });
  assert.equal(result.status, 'needs_information');
  assert.equal(result.found, false);
  assert.equal('locationId' in result, false);
  assert.equal(result.requiresNarrative, true);
});

test('known NPC location may guide travel without declaring the NPC found', () => {
  const npcs = new NpcRegistry();
  npcs.registerNpc({ id: 'npc-liuqing', name: '柳青', locationId: 'herb-shop' });

  const result = resolveFindNpc({ npcRegistry: npcs, npcName: '柳青', knownLocations: ['herb-shop'], currentLocationId: 'qinghe-city' });
  assert.equal(result.status, 'known_location');
  assert.equal(result.locationId, 'herb-shop');
  assert.equal(result.found, false);
});

test('dead NPC becomes a narrative result instead of a false location success', () => {
  const npcs = new NpcRegistry();
  npcs.registerNpc({ id: 'npc-liuqing', name: '柳青', locationId: 'herb-shop', status: 'dead' });

  const result = resolveFindNpc({ npcRegistry: npcs, npcName: '柳青' });
  assert.equal(result.status, 'dead');
  assert.equal(result.found, false);
  assert.equal(result.requiresNarrative, true);
});
