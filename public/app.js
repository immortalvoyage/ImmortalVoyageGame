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
    showMessage(`無法讀取世界：${error.message}`);
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
      if (result) showMessage(label + '：完成');
      await refresh();
    } catch (error) {
      showMessage(`${label}：${error.result?.code ?? error.message}`);
    }
  });
  return element;
}

function render() {
  birthPanel.hidden = true;
  gamePanel.hidden = false;
  locationName.textContent = view.location.name;
  locationDescription.textContent = view.location.description;
  narrativeText.textContent = view.narrative.text;

  const character = view.character;
  characterState.replaceChildren();
  const rows = [
    ['姓名', character.name],
    ['貨幣', String(character.money)],
    ['飢餓', String(character.needs.hunger)],
    ['口渴', String(character.needs.thirst)],
    ['疲勞', String(character.needs.fatigue)],
    ['背包', Object.entries(character.inventory).map(([id, qty]) => `${id} × ${qty}`).join('、') || '空'],
  ];
  for (const [key, value] of rows) {
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = key;
    dd.textContent = value;
    characterState.append(dt, dd);
  }

  narrativeActions.replaceChildren(...view.narrative.options.map((choice) => button(choice.label, choice.intent.type, choice.intent.payload)));
  const actions = [];
  if ((character.inventory.water ?? 0) > 0) actions.push(button('飲水', 'survival.consume', { kind: 'water' }, true));
  if ((character.inventory.food ?? 0) > 0) actions.push(button('進食', 'survival.consume', { kind: 'food' }, true));
  if (character.locationId === 'starter-square') {
    actions.push(button('買食物（1）', 'economy.buy', { itemId: 'food' }, true));
    actions.push(button('買水（1）', 'economy.buy', { itemId: 'water' }, true));
  }
  worldActions.replaceChildren(...actions);
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
    showMessage(`出生失敗：${error.result?.code ?? error.message}`);
  }
});

refresh();
