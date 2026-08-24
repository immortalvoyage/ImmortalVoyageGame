import { validateGameModuleManifest } from '../../core/module-manifest.js';
import { MAX_TRADE_LISTINGS } from '../../core/world-state.js';
import { getOwnedActiveCharacter } from '../../core/permission-boundary.js';
import { addStack, removeStack } from '../inventory/index.js';

const MAX_PUBLIC_TRADE_LISTINGS = 50;
const manifest = validateGameModuleManifest({
  name: 'trade',
  dataVersion: 1,
  actions: ['trade.list', 'trade.browse', 'trade.buy', 'trade.cancel'],
});

function isPositiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function listingSequence(listingId) {
  const match = /^listing:(\d+)$/.exec(String(listingId));
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function publicListing(world, actor, listing, itemCatalog) {
  const seller = world.characters[listing.sellerSessionId];
  const own = listing.sellerSessionId === actor.sessionId;
  return {
    id: listing.id,
    item: {
      name: itemCatalog[listing.itemId]?.name ?? '未知物品',
      quantity: listing.quantity,
    },
    totalPrice: listing.totalPrice,
    sellerName: seller?.name ?? '未知旅人',
    own,
    action: own
      ? { label: '取消寄售', intent: { type: 'trade.cancel', payload: { listingId: listing.id } } }
      : { label: '購買', intent: { type: 'trade.buy', payload: { listingId: listing.id } } },
  };
}

export function buildTradeViewForActor(world, actor, itemCatalog = {}) {
  const character = getOwnedActiveCharacter(world, actor);
  if (!character) return null;

  const sellables = Object.entries(character.inventory)
    .filter(([itemId, quantity]) => Object.hasOwn(itemCatalog, itemId) && isPositiveSafeInteger(quantity))
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([itemId, quantity]) => ({
      name: itemCatalog[itemId].name,
      maxQuantity: quantity,
      intent: { type: 'trade.list', payload: { itemId } },
    }));

  const listings = Object.values(world.tradeListings ?? {})
    .sort((left, right) => listingSequence(left.id) - listingSequence(right.id))
    .slice(0, MAX_PUBLIC_TRADE_LISTINGS)
    .map((listing) => publicListing(world, actor, listing, itemCatalog));

  return { sellables, listings };
}

function list({ world, actor, action, context }) {
  const character = getOwnedActiveCharacter(world, actor);
  if (!character) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };

  const itemId = action.payload?.itemId;
  const quantity = action.payload?.quantity;
  const totalPrice = action.payload?.totalPrice;
  if (typeof itemId !== 'string' || !Object.hasOwn(context.contentPack.items, itemId)) {
    return { ok: false, code: 'TRADE_ITEM_NOT_AVAILABLE' };
  }
  if (!isPositiveSafeInteger(quantity) || !isPositiveSafeInteger(totalPrice)) {
    return { ok: false, code: 'INVALID_TRADE_LISTING' };
  }
  if (Object.keys(world.tradeListings).length >= MAX_TRADE_LISTINGS
    || world.nextTradeListingSequence >= Number.MAX_SAFE_INTEGER) {
    return { ok: false, code: 'TRADE_LISTING_LIMIT_REACHED' };
  }
  if (!removeStack(character, itemId, quantity)) return { ok: false, code: 'TRADE_ITEM_NOT_AVAILABLE' };

  const listingId = `listing:${world.nextTradeListingSequence}`;
  world.nextTradeListingSequence += 1;
  const listing = {
    id: listingId,
    sellerSessionId: actor.sessionId,
    sellerCharacterId: character.id,
    itemId,
    quantity,
    totalPrice,
    createdLogicalTimeSeconds: world.logicalTimeSeconds,
  };
  world.tradeListings[listingId] = listing;

  return {
    ok: true,
    code: 'TRADE_LISTED',
    data: { listing: publicListing(world, actor, listing, context.contentPack.items) },
    events: [{
      type: 'trade.listed',
      data: {
        characterId: character.id,
        listingId,
        itemId,
        quantity,
        totalPrice,
      },
    }],
  };
}

function browse({ world, actor, context }) {
  const trade = buildTradeViewForActor(world, actor, context.contentPack.items);
  if (!trade) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  return { ok: true, code: 'TRADE_BROWSED', data: trade };
}

function buy({ world, actor, action, context }) {
  const buyer = getOwnedActiveCharacter(world, actor);
  if (!buyer) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };

  const listingId = action.payload?.listingId;
  const listing = typeof listingId === 'string' ? world.tradeListings[listingId] : null;
  if (!listing) return { ok: false, code: 'TRADE_LISTING_NOT_AVAILABLE' };
  if (listing.sellerSessionId === actor.sessionId) return { ok: false, code: 'TRADE_OWN_LISTING' };

  const seller = world.characters[listing.sellerSessionId];
  if (!seller || seller.id !== listing.sellerCharacterId || seller.status !== 'alive') {
    return { ok: false, code: 'TRADE_SELLER_UNAVAILABLE' };
  }
  if (buyer.money < listing.totalPrice) return { ok: false, code: 'INSUFFICIENT_FUNDS' };
  if (!Number.isSafeInteger(seller.money + listing.totalPrice)) return { ok: false, code: 'TRADE_BALANCE_LIMIT' };
  if (!Object.hasOwn(context.contentPack.items, listing.itemId)) return { ok: false, code: 'TRADE_ITEM_NOT_AVAILABLE' };

  buyer.money -= listing.totalPrice;
  seller.money += listing.totalPrice;
  addStack(buyer, listing.itemId, listing.quantity);
  delete world.tradeListings[listing.id];

  return {
    ok: true,
    code: 'TRADE_PURCHASED',
    data: {
      purchased: {
        name: context.contentPack.items[listing.itemId].name,
        quantity: listing.quantity,
        totalPrice: listing.totalPrice,
      },
      money: buyer.money,
    },
    events: [
      {
        type: 'trade.completed',
        data: {
          listingId: listing.id,
          sellerCharacterId: seller.id,
          buyerCharacterId: buyer.id,
          itemId: listing.itemId,
          quantity: listing.quantity,
          totalPrice: listing.totalPrice,
        },
      },
      {
        type: 'economy.money-transferred',
        data: {
          sourceCharacterId: buyer.id,
          targetCharacterId: seller.id,
          amount: listing.totalPrice,
          reason: 'trade',
        },
      },
    ],
  };
}

function cancel({ world, actor, action, context }) {
  const character = getOwnedActiveCharacter(world, actor);
  if (!character) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };

  const listingId = action.payload?.listingId;
  const listing = typeof listingId === 'string' ? world.tradeListings[listingId] : null;
  if (!listing) return { ok: false, code: 'TRADE_LISTING_NOT_AVAILABLE' };
  if (listing.sellerSessionId !== actor.sessionId || listing.sellerCharacterId !== character.id) {
    return { ok: false, code: 'TRADE_NOT_OWNER' };
  }
  if (!Object.hasOwn(context.contentPack.items, listing.itemId)) return { ok: false, code: 'TRADE_ITEM_NOT_AVAILABLE' };

  addStack(character, listing.itemId, listing.quantity);
  delete world.tradeListings[listing.id];
  return {
    ok: true,
    code: 'TRADE_CANCELLED',
    data: {
      returned: {
        name: context.contentPack.items[listing.itemId].name,
        quantity: listing.quantity,
      },
    },
    events: [{
      type: 'trade.cancelled',
      data: {
        characterId: character.id,
        listingId: listing.id,
        itemId: listing.itemId,
        quantity: listing.quantity,
      },
    }],
  };
}

export const tradeModule = {
  manifest,
  actions: {
    'trade.list': list,
    'trade.browse': browse,
    'trade.buy': buy,
    'trade.cancel': cancel,
  },
};
