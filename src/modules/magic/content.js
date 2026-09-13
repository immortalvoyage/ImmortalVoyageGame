const MAGIC_GRADES = new Set(['basic', 'intermediate', 'advanced', 'grand']);
const MAGIC_DOMAINS = new Set([
  'elemental', 'force', 'form', 'enhancement', 'transformation',
  'life', 'mind', 'detection', 'space', 'contract', 'seal', 'ritual',
  'summoning', 'necromancy', 'astrology', 'dream', 'music', 'blood',
  'alchemy', 'rune', 'curse', 'sacred', 'nature-spirit', 'dragon-language', 'ancient',
]);
const RESOLVER_KEY_RE = /^[a-z][a-z0-9.-]{0,63}$/;
const MAX_TECHNIQUES = 1000;
const MAX_METADATA_LIST = 16;
const MAX_PARAMETER_DEPTH = 5;
const MAX_PARAMETER_NODES = 128;

function fail(message) {
  throw new Error(`invalid magic content: ${message}`);
}

function requireRecord(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${path} must be an object`);
  return value;
}

function requireText(value, path, max = 256) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail(`${path} must be bounded non-empty text`);
  return value;
}
function validateTextList(value, path) {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length > MAX_METADATA_LIST) fail(`${path} must be a bounded array`);
  for (const [index, entry] of value.entries()) requireText(entry, `${path}[${index}]`);
}

function validateBoundedData(value, path, depth = 0, state = { nodes: 0 }) {
  state.nodes += 1;
  if (state.nodes > MAX_PARAMETER_NODES || depth > MAX_PARAMETER_DEPTH) fail(`${path} is too large`);
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail(`${path} must contain finite numbers`);
    return;
  }
  if (typeof value === 'string') {
    if (value.length > 256) fail(`${path} string is too long`);
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 32) fail(`${path} array is too large`);
    value.forEach((entry, index) => validateBoundedData(entry, `${path}[${index}]`, depth + 1, state));
    return;
  }
  const record = requireRecord(value, path);
  const entries = Object.entries(record);
  if (entries.length > 32) fail(`${path} object is too large`);
  for (const [key, entry] of entries) {
    requireText(key, `${path} key`, 64);
    validateBoundedData(entry, `${path}.${key}`, depth + 1, state);
  }
}
export function validateMagicContent(magic) {
  if (magic === undefined) return null;
  const root = requireRecord(magic, 'magic');
  const techniques = requireRecord(root.techniques, 'magic.techniques');
  const entries = Object.entries(techniques);
  if (entries.length > MAX_TECHNIQUES) fail('magic.techniques exceeds supported size');

  for (const [techniqueId, technique] of entries) {
    requireText(techniqueId, 'magic technique id', 64);
    const path = `magic.techniques.${techniqueId}`;
    requireRecord(technique, path);
    requireText(technique.name, `${path}.name`);
    if (!MAGIC_GRADES.has(technique.grade)) fail(`${path}.grade is not a supported world grade`);
    if (technique.forbidden !== undefined && typeof technique.forbidden !== 'boolean') fail(`${path}.forbidden must be boolean`);

    if (!Array.isArray(technique.domains) || technique.domains.length === 0 || technique.domains.length > MAGIC_DOMAINS.size) {
      fail(`${path}.domains must be a non-empty bounded array`);
    }
    const seenDomains = new Set();
    for (const [index, domain] of technique.domains.entries()) {
      requireText(domain, `${path}.domains[${index}]`, 64);
      if (!MAGIC_DOMAINS.has(domain)) fail(`${path}.domains[${index}] is not a known backend domain`);
      if (seenDomains.has(domain)) fail(`${path}.domains contains duplicate domain: ${domain}`);
      seenDomains.add(domain);
    }

    const effect = requireRecord(technique.effect, `${path}.effect`);
    const resolverKey = requireText(effect.resolverKey, `${path}.effect.resolverKey`, 64);
    if (!RESOLVER_KEY_RE.test(resolverKey)) fail(`${path}.effect.resolverKey is invalid`);
    if (effect.parameters !== undefined) validateBoundedData(effect.parameters, `${path}.effect.parameters`);
    validateTextList(technique.limitations, `${path}.limitations`);
    validateTextList(technique.counterplay, `${path}.counterplay`);
    validateTextList(technique.failureModes, `${path}.failureModes`);
  }
  return magic;
}

export const magicContentContract = Object.freeze({
  grades: Object.freeze([...MAGIC_GRADES]),
  domains: Object.freeze([...MAGIC_DOMAINS]),
});
