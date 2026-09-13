export const MOBILE_TAB_ORDER = Object.freeze([
  'actions',
  'travel',
  'dialogue',
  'trade',
  'scene',
  'character',
]);

export function chooseMobileTab(current, availability = {}) {
  if (availability[current]) return current;
  return MOBILE_TAB_ORDER.find((tab) => availability[tab]) ?? 'scene';
}
