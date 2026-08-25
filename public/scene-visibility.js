function normalizedText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function shouldShowNarrativeText(locationDescription, narrativeText) {
  const narrative = normalizedText(narrativeText);
  if (!narrative) return false;
  return narrative !== normalizedText(locationDescription);
}

export function shouldShowUtilityPanel(utilities) {
  return Array.isArray(utilities) && utilities.length > 0;
}
