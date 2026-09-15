const NAME_RE = /^[a-z][a-z0-9-]*$/;

export function validateGameModuleManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') throw new TypeError('manifest is required');
  if (!NAME_RE.test(manifest.name ?? '')) throw new Error('invalid module name');
  if (!Number.isInteger(manifest.dataVersion) || manifest.dataVersion < 1) throw new Error('invalid dataVersion');
  if (!Array.isArray(manifest.actions)) throw new Error('actions must be an array');
  if (new Set(manifest.actions).size !== manifest.actions.length) throw new Error('duplicate actions in manifest');
  const untrackedActions = manifest.untrackedActions ?? [];
  if (!Array.isArray(untrackedActions)) throw new Error('untrackedActions must be an array');
  if (new Set(untrackedActions).size !== untrackedActions.length) throw new Error('duplicate untrackedActions in manifest');
  for (const actionType of untrackedActions) {
    if (!manifest.actions.includes(actionType)) throw new Error('untracked action must be registered');
  }
  return Object.freeze({
    ...manifest,
    actions: Object.freeze([...manifest.actions]),
    untrackedActions: Object.freeze([...untrackedActions]),
  });
}
