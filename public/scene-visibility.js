function normalizedText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function narrativeTextForDisplay(locationDescription, narrativeText) {
  const location = normalizedText(locationDescription);
  const narrative = normalizedText(narrativeText);
  if (!narrative) return '';
  if (!location) return narrative;
  if (narrative === location) return '';
  if (narrative.startsWith(location)) {
    const remainder = narrative.slice(location.length);
    if (/^\s/.test(remainder)) return remainder.trim();
  }
  return narrative;
}

export function shouldShowNarrativeText(locationDescription, narrativeText) {
  return narrativeTextForDisplay(locationDescription, narrativeText).length > 0;
}

export function shouldShowUtilityPanel(utilities) {
  return Array.isArray(utilities) && utilities.length > 0;
}
