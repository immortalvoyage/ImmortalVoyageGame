function text(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function formatActionResult(result, fallbackLabel = '行動') {
  const fallback = `${text(fallbackLabel, '行動')}：完成`;
  if (!result?.ok) return fallback;

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
