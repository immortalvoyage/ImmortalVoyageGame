export function createNarrativeContext({
  sceneId,
  locationId,
  summary,
  relationship = "neutral",
  danger = "normal",
  intent = null,
  capabilities = [],
  worldFacts = [],
  tags = []
} = {}) {
  if (!sceneId) throw new Error("sceneId is required");
  if (!locationId) throw new Error("locationId is required");
  if (!summary) throw new Error("summary is required");

  return Object.freeze({
    sceneId: String(sceneId),
    locationId: String(locationId),
    summary: String(summary),
    relationship: String(relationship),
    danger: String(danger),
    intent: intent == null ? null : String(intent),
    capabilities: Object.freeze([...capabilities]),
    worldFacts: Object.freeze([...worldFacts]),
    tags: Object.freeze([...tags])
  });
}
