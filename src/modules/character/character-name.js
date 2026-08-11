const MIN_GRAPHEMES = 2;
const MAX_GRAPHEMES = 24;
const ALLOWED_NAME = /^[\p{L}\p{M}]+(?:[ '\u2019\-\u2010\u00B7\u30FB][\p{L}\p{M}]+)*$/u;
const FORBIDDEN_FORMAT = /[\p{Cc}\p{Cf}\p{Cs}]/u;
const RESERVED = Object.freeze([
  'gm',
  'admin',
  'administrator',
  'system',
  'official',
  'moderator',
  'immortalvoyage',
  '仙遊者',
  '老祖',
]);

function graphemeLength(value) {
  if (typeof Intl?.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(segmenter.segment(value)).length;
  }
  return Array.from(value).length;
}

function reservedKey(value) {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[ '\u2019\-\u2010\u00B7\u30FB]/gu, '');
}

export function normalizeCharacterName(value) {
  if (typeof value !== 'string') throw new TypeError('characterName is required');
  return value.normalize('NFC').trim().replace(/\s+/gu, ' ');
}

export function validateCharacterName(value) {
  if (typeof value !== 'string') throw new TypeError('characterName is required');
  if (FORBIDDEN_FORMAT.test(value)) {
    return Object.freeze({ valid: false, reason: 'name_forbidden_format', name: value });
  }

  const name = normalizeCharacterName(value);
  if (!name) return Object.freeze({ valid: false, reason: 'name_required', name });

  const length = graphemeLength(name);
  if (length < MIN_GRAPHEMES) return Object.freeze({ valid: false, reason: 'name_too_short', name });
  if (length > MAX_GRAPHEMES) return Object.freeze({ valid: false, reason: 'name_too_long', name });
  if (!ALLOWED_NAME.test(name)) return Object.freeze({ valid: false, reason: 'name_invalid_characters', name });

  const key = reservedKey(name);
  if (RESERVED.some((reserved) => key === reservedKey(reserved))) {
    return Object.freeze({ valid: false, reason: 'name_reserved', name });
  }

  return Object.freeze({ valid: true, reason: 'valid_name', name });
}

export function assertCharacterName(value) {
  const result = validateCharacterName(value);
  if (!result.valid) {
    const error = new TypeError(`invalid character name: ${result.reason}`);
    error.code = result.reason;
    throw error;
  }
  return result.name;
}

export const CHARACTER_NAME_LIMITS = Object.freeze({ min: MIN_GRAPHEMES, max: MAX_GRAPHEMES });
