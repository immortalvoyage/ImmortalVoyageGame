function text(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function failureMessage(code, fallbackLabel) {
  switch (code) {
    case 'INSUFFICIENT_FUNDS':
      return '金錢不足。';
    case 'RESOURCE_NOT_AVAILABLE':
      return '這裡目前無法取得該資源。';
    case 'ITEM_NOT_AVAILABLE':
      return '你目前沒有可使用的該物品。';
    case 'ROUTE_NOT_AVAILABLE':
    case 'PURPOSE_ROUTE_UNAVAILABLE':
      return '目前沒有可行的路線。';
    case 'NPC_NOT_AVAILABLE':
      return '這個人目前不在你能互動的位置。';
    case 'PURPOSE_TARGET_UNKNOWN':
      return '你目前沒有足夠情報尋找這個目標。';
    case 'WORK_NOT_AVAILABLE':
      return '這裡目前沒有這份工作。';
    case 'MARKET_NOT_AVAILABLE':
      return '這裡目前無法交易。';
    case 'ITEM_NOT_SOLD':
      return '這裡沒有販售該物品。';
    case 'CHARACTER_EXISTS':
      return '這個工作階段已經有角色。';
    case 'INVALID_NAME':
      return '請輸入 1～24 個字的角色姓名。';
    case 'UNKNOWN_ACTION':
      return '這個行動目前不可用。';
    case 'UNAUTHENTICATED':
      return '工作階段已失效，請重新載入頁面。';
    default:
      return `${text(fallbackLabel, '行動')}：無法完成。`;
  }
}

export function formatActionResult(result, fallbackLabel = '行動') {
  if (!result?.ok) return failureMessage(result?.code, fallbackLabel);
  const fallback = `${text(fallbackLabel, '行動')}：完成`;

  switch (result.code) {
    case 'NPC_INTERACTION':
      return text(result.data?.text, fallback);
    case 'TRAVEL_COMPLETED': {
      const location = text(result.data?.location?.name);
      return location ? `已抵達${location}。` : fallback;
    }
    case 'PURPOSE_SEARCH_PROGRESS': {
      const location = text(result.data?.location?.name);
      const target = text(result.data?.target?.name);
      if (location && target) return `你先前往${location}，繼續尋找${target}。`;
      return fallback;
    }
    case 'PURPOSE_TARGET_FOUND': {
      const target = text(result.data?.npc?.name);
      return target ? `你找到了${target}。` : fallback;
    }
    case 'RESOURCE_GATHERED':
      return `${text(fallbackLabel, '採集')}：已取得資源。`;
    case 'ITEM_CONSUMED':
      return `${text(fallbackLabel, '使用物品')}：完成。`;
    case 'WORK_COMPLETED':
      return `${text(fallbackLabel, '工作')}：完成，報酬已入帳。`;
    case 'PURCHASE_COMPLETED':
      return `${text(fallbackLabel, '購買')}：交易完成。`;
    default:
      return fallback;
  }
}
