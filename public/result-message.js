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
    case 'NPC_TOPIC_NOT_AVAILABLE':
      return '你目前還無法從這個人那裡問到這件事。';
    case 'PURPOSE_TARGET_UNKNOWN':
      return '你目前沒有足夠情報尋找這個目標。';
    case 'WORK_NOT_AVAILABLE':
      return '這裡目前沒有這份工作。';
    case 'SURVIVAL_CONDITION_TOO_POOR':
      return '目前的飢餓、口渴或疲勞狀況太差，先補給或休整後再工作。';
    case 'MARKET_NOT_AVAILABLE':
      return '這裡目前無法交易。';
    case 'ITEM_NOT_SOLD':
      return '這裡沒有販售該物品。';
    case 'CRAFT_NOT_AVAILABLE':
      return '這裡目前無法進行這項製作。';
    case 'CRAFT_MATERIALS_MISSING':
      return '製作材料不足。';
    case 'TRADE_ITEM_NOT_AVAILABLE':
      return '這個物品目前無法寄售或交付。';
    case 'INVALID_TRADE_LISTING':
      return '寄售數量與價格必須是正整數。';
    case 'TRADE_LISTING_LIMIT_REACHED':
      return '目前寄售欄位已滿。';
    case 'TRADE_LISTING_NOT_AVAILABLE':
      return '這筆寄售已不存在或已成交。';
    case 'TRADE_OWN_LISTING':
      return '不能購買自己的寄售。';
    case 'TRADE_NOT_OWNER':
      return '你不能取消別人的寄售。';
    case 'TRADE_SELLER_UNAVAILABLE':
      return '賣方目前無法完成交易。';
    case 'TRADE_BALANCE_LIMIT':
      return '這筆交易目前無法結算。';
    case 'TRADE_INVENTORY_LIMIT':
      return '物品數量已達目前可安全保存的上限。';
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
    case 'NPC_TOPIC_RESPONSE':
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
    case 'REST_COMPLETED':
      return '你休息了一會兒，疲勞有所緩解。';
    case 'WORK_COMPLETED':
      return `${text(fallbackLabel, '工作')}：完成，報酬已入帳。`;
    case 'PURCHASE_COMPLETED':
      return `${text(fallbackLabel, '購買')}：交易完成。`;
    case 'CRAFT_COMPLETED': {
      const name = text(result.data?.crafted?.name);
      const quantity = result.data?.crafted?.quantity;
      return name && Number.isSafeInteger(quantity) && quantity > 0 ? `已製作${name} × ${quantity}。` : fallback;
    }
    case 'TRADE_LISTED':
      return '寄售已上架，物品已進入交易保管。';
    case 'TRADE_PURCHASED': {
      const name = text(result.data?.purchased?.name);
      const quantity = result.data?.purchased?.quantity;
      const totalPrice = result.data?.purchased?.totalPrice;
      if (name && Number.isSafeInteger(quantity) && quantity > 0 && Number.isSafeInteger(totalPrice) && totalPrice > 0) {
        return `已用 ${totalPrice} 貨幣購買${name} × ${quantity}。`;
      }
      return fallback;
    }
    case 'TRADE_CANCELLED': {
      const name = text(result.data?.returned?.name);
      const quantity = result.data?.returned?.quantity;
      return name && Number.isSafeInteger(quantity) && quantity > 0 ? `已取消寄售，取回${name} × ${quantity}。` : fallback;
    }
    default:
      return fallback;
  }
}
