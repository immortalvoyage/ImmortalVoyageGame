import { formatActionResult } from './result-message.js';

const birthPanel = document.querySelector('#birth-panel');
const gamePanel = document.querySelector('#game-panel');
const birthForm = document.querySelector('#birth-form');
const message = document.querySelector('#message');
const narrativeActions = document.querySelector('#narrative-actions');
const worldActions = document.querySelector('#world-actions');
const locationName = document.querySelector('#location-name');
const locationDescription = document.querySelector('#location-description');
const narrativeText = document.querySelector('#narrative-text');
const characterState = document.querySelector('#character-state');
const tradePanel = document.querySelector('#trade-panel');
const tradeForm = document.querySelector('#trade-form');
const tradeItem = document.querySelector('#trade-item');
const tradeQuantity = document.querySelector('#trade-quantity');
const tradePrice = document.querySelector('#trade-price');
const tradeSubmit = document.querySelector('#trade-submit');
const tradeListings = document.querySelector('#trade-listings');

let view = null;
let busy = false;

function requestId() {
  return crypto.randomUUID();
}

async function act(type, payload = {}) {
  if (busy) return null;
  busy = true;
  document.querySelectorAll('button').forEach((button) => { button.disabled = true; });
  try {
    const response = await fetch('/api/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requestId: requestId(), action: { type, payload } }),
    });
    const result = await response.json();
    if (!result.ok) throw Object.assign(new Error(result.code), { result });
    return result;
  } finally {
    busy = false;
    document.querySelectorAll('button').forEach((button) => { button.disabled = false; });
  }
}

async function refresh() {
  try {
    const result = await act('narrative.scene');
    if (!result) return;
    view = result.data;
    render();
  } catch (error) {
    if (error.result?.code === 'NO_ACTIVE_CHARACTER') {
      birthPanel.hidden = false;
      gamePanel.hidden = true;
      return;
    }
    showMessage(formatActionResult(error.result ?? { ok: false }, '讀取世界'));
  }
}

function button(label, type, payload, secondary = false) {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  if (secondary) element.className = 'secondary';
  element.addEventListener('click', async () => {
    try {
      const result = await act(type, payload);
      if (result) showMessage(formatActionResult(result, label));
      await refresh();
    } catch (error) {
      showMessage(formatActionResult(error.result ?? { ok: false }, label));
    }
  });
  return element;
}

function renderTrade() {
  if (!view.trade) {
    tradePanel.hidden = true;
    return;
  }

  tradePanel.hidden = false;
  const sellables = view.trade.sellables ?? [];
  tradeItem.replaceChildren(...sellables.map((sellable, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${sellable.name}（最多 ${sellable.maxQuantity}）`;
    return option;
  }));

  const selected = sellables[Number(tradeItem.value)] ?? sellables[0];
  const hasSellable = Boolean(selected);
  tradeItem.disabled = !hasSellable;
  tradeQuantity.disabled = !hasSellable;
  tradePrice.disabled = !hasSellable;
  tradeSubmit.disabled = !hasSellable;
  if (hasSellable) {
    tradeQuantity.max = String(selected.maxQuantity);
    const currentQuantity = Number(tradeQuantity.value);
    if (!Number.isSafeInteger(currentQuantity) || currentQuantity < 1 || currentQuantity > selected.maxQuantity) {
      tradeQuantity.value = '1';
    }
    if (!Number.isSafeInteger(Number(tradePrice.value)) || Number(tradePrice.value) < 1) tradePrice.value = '1';
  } else {
    tradeQuantity.removeAttribute('max');
    tradeQuantity.value = '';
    tradePrice.value = '';
  }

  const listingNodes = (view.trade.listings ?? []).map((listing) => {
    const row = document.createElement('div');
    row.className = 'trade-listing';
    const details = document.createElement('p');
    const ownerText = listing.own ? '你的寄售' : `賣方：${listing.sellerName}`;
    details.textContent = `${listing.item.name} × ${listing.item.quantity}｜總價 ${listing.totalPrice}｜${ownerText}`;
    row.append(details, button(listing.action.label, listing.action.intent.type, listing.action.intent.payload, true));
    return row;
  });
  if (listingNodes.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'subtle';
    empty.textContent = '目前沒有寄售。';
    listingNodes.push(empty);
  }
  tradeListings.replaceChildren(...listingNodes);
}

function render() {
  birthPanel.hidden = true;
  gamePanel.hidden = false;
  locationName.textContent = view.location.name;
  locationDescription.textContent = view.location.description;
  narrativeText.textContent = view.narrative.text;

  const character = view.character;
  const inventoryText = (view.inventoryItems ?? [])
    .map((item) => `${item.name} × ${item.quantity}`)
    .join('、') || '空';
  const careerText = (view.careers ?? []).map((career) => career.name).join('、') || '尚未形成';
  characterState.replaceChildren();
  const rows = [
    ['姓名', character.name],
    ['身分', careerText],
  ];
  if (view.progression) {
    const skillText = (view.progression.skills ?? []).map((skill) => skill.name).join('、') || '尚未形成';
    const socialTagText = (view.progression.socialTags ?? []).map((tag) => tag.name).join('、') || '尚未形成';
    rows.push(['技能', skillText], ['社會標籤', socialTagText]);
  }
  if (Array.isArray(view.relationships)) {
    const relationshipText = view.relationships
      .map((relationship) => `${relationship.npc.name}：${relationship.familiarity.name}`)
      .join('、') || '尚未形成';
    rows.push(['關係', relationshipText]);
  }
  if (Array.isArray(view.knowledge)) {
    const knowledgeText = view.knowledge.map((fact) => fact.name).join('、') || '尚無';
    rows.push(['已知情報', knowledgeText]);
  }
  rows.push(
    ['貨幣', String(character.money)],
    ['飢餓', String(character.needs.hunger)],
    ['口渴', String(character.needs.thirst)],
    ['疲勞', String(character.needs.fatigue)],
    ['背包', inventoryText],
  );
  for (const [key, value] of rows) {
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = key;
    dd.textContent = value;
    characterState.append(dt, dd);
  }

  narrativeActions.replaceChildren(...view.narrative.options.map((choice) => button(choice.label, choice.intent.type, choice.intent.payload)));
  worldActions.replaceChildren(...view.utilities.map((utility) => button(utility.label, utility.intent.type, utility.intent.payload, true)));
  renderTrade();
}

function showMessage(text) {
  message.textContent = text;
}

birthForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = document.querySelector('#character-name').value;
  try {
    await act('character.birth', { name });
    showMessage('角色已出生。');
    await refresh();
  } catch (error) {
    showMessage(formatActionResult(error.result ?? { ok: false }, '出生'));
  }
});

tradeItem.addEventListener('change', () => {
  const sellable = view?.trade?.sellables?.[Number(tradeItem.value)];
  if (!sellable) return;
  tradeQuantity.max = String(sellable.maxQuantity);
  if (Number(tradeQuantity.value) > sellable.maxQuantity) tradeQuantity.value = String(sellable.maxQuantity);
});

tradeForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const sellable = view?.trade?.sellables?.[Number(tradeItem.value)];
  if (!sellable) return;
  const payload = {
    ...sellable.intent.payload,
    quantity: Number(tradeQuantity.value),
    totalPrice: Number(tradePrice.value),
  };
  try {
    const result = await act(sellable.intent.type, payload);
    if (result) showMessage(formatActionResult(result, '上架寄售'));
    await refresh();
  } catch (error) {
    showMessage(formatActionResult(error.result ?? { ok: false }, '上架寄售'));
  }
});

refresh();
