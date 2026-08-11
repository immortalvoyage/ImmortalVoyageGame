const BUG_SEVERITIES = Object.freeze(['S0','S1','S2','S3','S4']);
const BUG_STATES = Object.freeze(['submitted','accepted','investigating','fixed','verified','closed','rejected']);

const REWARD_POLICY = Object.freeze({
  S0: Object.freeze({ contributionPoints: 1, worldRecognition: false }),
  S1: Object.freeze({ contributionPoints: 3, worldRecognition: false }),
  S2: Object.freeze({ contributionPoints: 8, worldRecognition: false }),
  S3: Object.freeze({ contributionPoints: 20, worldRecognition: true }),
  S4: Object.freeze({ contributionPoints: 50, worldRecognition: true, confidentialDetails: true }),
});

function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${field} is required`);
  return value.trim();
}

export function createBugReport({ reportId, playerId, characterId = null, description, attachments = [], context = {} }) {
  if (!Array.isArray(attachments) || attachments.length > 3) throw new RangeError('attachments must contain at most 3 items');
  return Object.freeze({
    reportId: requireText(reportId, 'reportId'),
    playerId: requireText(playerId, 'playerId'),
    characterId: characterId ? requireText(characterId, 'characterId') : null,
    description: requireText(description, 'description'),
    attachments: Object.freeze(attachments.map((item) => Object.freeze({
      name: requireText(item?.name, 'attachment.name'),
      contentType: requireText(item?.contentType, 'attachment.contentType'),
      size: Number(item?.size) || 0,
    }))),
    context: Object.freeze({ ...context }),
    state: 'submitted',
    severity: null,
    reward: null,
  });
}

export function classifyBugSeverity({ visualOnly = false, gameplayBlocked = false, dataCorruption = false, economyExploit = false, authorizationBypass = false, worldIntegrityRisk = false }) {
  if (authorizationBypass || economyExploit || worldIntegrityRisk) return 'S4';
  if (dataCorruption) return 'S3';
  if (gameplayBlocked) return 'S2';
  if (visualOnly) return 'S0';
  return 'S1';
}

export function buildBugReward(severity) {
  if (!BUG_SEVERITIES.includes(severity)) throw new TypeError('unsupported bug severity');
  return Object.freeze({ severity, ...REWARD_POLICY[severity] });
}

export function sanitizePublicBugRecognition({ severity, playerName }) {
  if (!BUG_SEVERITIES.includes(severity)) throw new TypeError('unsupported bug severity');
  const name = requireText(playerName, 'playerName');
  if (severity === 'S4') {
    return Object.freeze({ title: '世界守望者', text: `${name} 協助發現並阻止了一項重大世界異常。`, discloseDetails: false });
  }
  if (severity === 'S3') {
    return Object.freeze({ title: '補天者', text: `${name} 協助修補了一項影響世界運行的重要異常。`, discloseDetails: false });
  }
  return Object.freeze({ title: null, text: null, discloseDetails: false });
}

export { BUG_SEVERITIES, BUG_STATES, REWARD_POLICY };
