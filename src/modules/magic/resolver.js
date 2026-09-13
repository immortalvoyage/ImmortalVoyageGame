import { validateMagicContent } from './content.js';

function cloneBounded(value) {
  try {
    return structuredClone(value);
  } catch {
    return null;
  }
}

export function resolveMagicTechnique({ magic, techniqueId, input = {}, effectResolvers = {} }) {
  validateMagicContent(magic);
  const technique = magic?.techniques?.[techniqueId];
  if (!technique) return { ok: false, code: 'MAGIC_TECHNIQUE_UNKNOWN' };

  const resolver = effectResolvers[technique.effect.resolverKey];
  if (typeof resolver !== 'function') return { ok: false, code: 'MAGIC_EFFECT_RESOLVER_UNAVAILABLE' };

  const safeInput = cloneBounded(input);
  const safeParameters = cloneBounded(technique.effect.parameters ?? {});
  if (safeInput === null || safeParameters === null) return { ok: false, code: 'MAGIC_INPUT_INVALID' };

  let effect;
  try {
    effect = resolver({ techniqueId, input: safeInput, parameters: safeParameters });
  } catch {
    return { ok: false, code: 'MAGIC_EFFECT_RESOLUTION_FAILED' };
  }
  if (effect && typeof effect.then === 'function') return { ok: false, code: 'MAGIC_EFFECT_RESOLVER_ASYNC' };
  const safeEffect = cloneBounded(effect);
  if (!safeEffect || typeof safeEffect !== 'object' || Array.isArray(safeEffect)) {
    return { ok: false, code: 'MAGIC_EFFECT_INVALID' };
  }
  return {
    ok: true,
    code: 'MAGIC_EFFECT_RESOLVED',
    proposal: { techniqueId, effect: safeEffect },
  };
}
