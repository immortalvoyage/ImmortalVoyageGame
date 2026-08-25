import { validateGameModuleManifest } from '../../core/module-manifest.js';
import { worldInstantFromWorld } from '../../core/world-calendar.js';

const manifest = validateGameModuleManifest({
  name: 'life',
  dataVersion: 1,
  actions: ['life.create-pending'],
});

function isAccountId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 128 && value.trim() === value;
}

function publicPendingLife(pendingLife) {
  return {
    status: pendingLife.status,
    birthWorldInstant: structuredClone(pendingLife.birthWorldInstant),
  };
}

function createPendingLife({ world, actor }) {
  if (!isAccountId(actor?.accountId)) return { ok: false, code: 'ACCOUNT_ID_REQUIRED' };
  const existing = world.pendingLives[actor.accountId];
  if (existing) return { ok: true, code: 'PENDING_LIFE_READY', data: { pendingLife: publicPendingLife(existing) } };

  const birthWorldInstant = worldInstantFromWorld(world);
  const pendingLife = {
    ownerAccountId: actor.accountId,
    status: 'pending',
    birthWorldInstant,
    createdLogicalTimeSeconds: world.logicalTimeSeconds,
  };
  world.pendingLives[actor.accountId] = pendingLife;
  return {
    ok: true,
    code: 'PENDING_LIFE_CREATED',
    data: { pendingLife: publicPendingLife(pendingLife) },
    events: [{ type: 'life.pending-created', data: { accountId: actor.accountId } }],
  };
}

export const lifeModule = {
  manifest,
  actions: { 'life.create-pending': createPendingLife },
};
