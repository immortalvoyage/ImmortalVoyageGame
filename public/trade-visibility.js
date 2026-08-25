export function shouldShowTradePanel(trade) {
  if (!trade) return false;
  const sellables = Array.isArray(trade.sellables) ? trade.sellables : [];
  const listings = Array.isArray(trade.listings) ? trade.listings : [];
  return sellables.length > 0 || listings.length > 0;
}
