const MAX_NAME_CODE_POINTS = 24;

const FORBIDDEN_FORMAT = /[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/u;
const ALLOWED_NAME = /^[\p{L}\p{M}\p{N} '\u2019\u00b7\u30fb-]+$/u;
const HAS_LETTER = /\p{L}/u;
const EDGE_PUNCTUATION = /^[-'\u2019\u00b7\u30fb]|[-'\u2019\u00b7\u30fb]$/u;
const REPEATED_SEPARATOR = /(?: {2,}|[-'\u2019\u00b7\u30fb]{2,}| [-'\u2019\u00b7\u30fb]|[-'\u2019\u00b7\u30fb] )/u;
const LONG_DIGIT_RUN = /\d{8,}/u;

const CONFUSABLES = new Map(Object.entries({
  '\u0430': 'a', '\u0435': 'e', '\u043e': 'o', '\u0440': 'p', '\u0441': 'c', '\u0445': 'x',
  '\u0443': 'y', '\u043a': 'k', '\u043c': 'm', '\u0442': 't', '\u0432': 'b', '\u043d': 'h',
  '\u0456': 'i', '\u0458': 'j', '\u03b1': 'a', '\u03bf': 'o', '\u03c1': 'p', '\u03c7': 'x',
  '\u03c5': 'y', '\u03b9': 'i', '\u03ba': 'k', '\u03bc': 'm', '\u03c4': 't',
}));

const RESERVED_EXACT = new Set([
  'gm', 'admin', 'administrator', 'owner', 'support', 'moderator', 'mod', 'gamemaster',
  'system', 'official', 'customerservice', '客服', '管理員', '系統', '官方', '知微', '長生', '老祖',
]);

const BLOCKED_PHRASES = Object.freeze([
  'heilhitler', 'whitepower', 'rape', '強姦', '性侵', '殺你全家',
  '販毒', '買毒品', '賣毒品', 'buydrugs', 'selldrugs',
]);

function foldConfusables(value) {
  return [...value].map((char) => CONFUSABLES.get(char) ?? char).join('');
}

function comparisonKey(value) {
  const lowered = value.normalize('NFKC').toLocaleLowerCase('und');
  const folded = foldConfusables(lowered);
  return folded.replace(/[\s'\u2019\u00b7\u30fb-]+/gu, '');
}

function isReserved(key) {
  if (RESERVED_EXACT.has(key)) return true;
  const withoutNumericSuffix = key.replace(/[0-9]+$/u, '');
  return withoutNumericSuffix !== key && RESERVED_EXACT.has(withoutNumericSuffix);
}

function containsBlockedPhrase(key) {
  return BLOCKED_PHRASES.some((phrase) => key.includes(phrase));
}

export function validatePlayerDisplayName(raw) {
  if (typeof raw !== 'string' || FORBIDDEN_FORMAT.test(raw)) return { ok: false, reason: 'unsafe-format' };
  const normalized = raw.normalize('NFKC').replace(/\p{Zs}+/gu, ' ').trim();
  const length = [...normalized].length;
  if (length < 1 || length > MAX_NAME_CODE_POINTS) return { ok: false, reason: 'length' };
  if (!HAS_LETTER.test(normalized) || !ALLOWED_NAME.test(normalized)) return { ok: false, reason: 'unsupported-character' };
  if (EDGE_PUNCTUATION.test(normalized) || REPEATED_SEPARATOR.test(normalized)) return { ok: false, reason: 'separator' };
  if (LONG_DIGIT_RUN.test(normalized)) return { ok: false, reason: 'sensitive-data' };

  const key = comparisonKey(normalized);
  if (isReserved(key)) return { ok: false, reason: 'reserved' };
  if (containsBlockedPhrase(key)) return { ok: false, reason: 'blocked-content' };
  return { ok: true, name: normalized, comparisonKey: key };
}
