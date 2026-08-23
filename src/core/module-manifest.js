const NAME_RE = /^[a-z][a-z0-9-]*$/;

export function validateGameModuleManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') throw new TypeError('manifest is required');
  if (!NAME_RE.test(manifest.name ?? '')) throw new Error('invalid module name');
  if (!Number.isInteger(manifest.dataVersion) || manifest.dataVersion < 1) throw new Error('invalid dataVersion');
  if (!Array.isArray(manifest.actions)) throw new Error('actions must be an array');
  if (new Set(manifest.actions).size !== manifest.actions.length) throw new Error('duplicate actions in manifest');
  return Object.freeze({ ...manifest, actions: Object.freeze([...manifest.actions]) });
}
