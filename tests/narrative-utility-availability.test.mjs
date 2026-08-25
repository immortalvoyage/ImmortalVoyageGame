import test from 'node:test';
import assert from 'node:assert/strict';
import { canBuyOffer, canCraftRecipe } from '../src/modules/narrative/utility-availability.js';

test('craft feasibility requires every authoritative recipe input', () => {
  const recipe = {
    inputs: [
      { itemId: 'bread', quantity: 1 },
      { itemId: 'water', quantity: 1 },
    ],
  };
  assert.equal(canCraftRecipe({ inventory: {} }, recipe), false);
  assert.equal(canCraftRecipe({ inventory: { bread: 1 } }, recipe), false);
  assert.equal(canCraftRecipe({ inventory: { bread: 1, water: 1 } }, recipe), true);
});

test('buy feasibility requires enough current authoritative money', () => {
  const offer = { price: 2 };
  assert.equal(canBuyOffer({ money: 0 }, offer), false);
  assert.equal(canBuyOffer({ money: 1 }, offer), false);
  assert.equal(canBuyOffer({ money: 2 }, offer), true);
});
