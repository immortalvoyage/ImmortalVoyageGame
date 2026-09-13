import { postActionWithRecovery } from './action-client.js';
import { forgetPendingAction, readPendingAction, rememberPendingAction } from './action-recovery-state.js';
import { buildCharacterSummaryRows } from './character-summary.js';
import { formatActionResult } from './result-message.js';
import { shouldShowTradePanel } from './trade-visibility.js';
import { narrativeTextForDisplay, shouldShowUtilityPanel } from './scene-visibility.js';
import { chooseMobileTab } from './mobile-tabs.js';

const pageMode = document.body.dataset.mode ?? '';
const onboardingMode = pageMode === 'onboarding';
const tutorialMode = pageMode === 'tutorial' || onboardingMode;

const birthPanel = document.querySelector('#birth-panel');
const gamePanel = document.querySelector('#game-panel');
const birthForm = document.querySelector('#birth-form');
const message = document.querySelector('#message');
const recoveryPanel = document.querySelector('#recovery-panel');
const recoveryText = document.querySelector('#recovery-text');
const recoveryButton = document.querySelector('#recovery-button');
const narrativeActions = document.querySelector('#narrative-actions');
const worldActions = document.querySelector('#world-actions');
const travelPanel = document.querySelector('#travel-panel');
const travelActions = document.querySelector('#travel-actions');
const dialoguePanel = document.querySelector('#dialogue-panel');
const dialogueActions = document.querySelector('#dialogue-actions');
const utilityPanel = document.querySelector('#utility-panel');
const locationName = document.querySelector('#location-name');
const locationDescription = document.querySelector('#location-description');
const narrativeText = document.querySelector('#narrative-text');
const characterState = document.querySelector('#character-state');
const characterPager = document.querySelector('#character-pager');
const tradePanel = document.querySelector('#trade-panel');
const tradeForm = document.querySelector('#trade-form');
const tradeItem = document.querySelector('#trade-item');
const tradeQuantity = document.querySelector('#trade-quantity');
const tradePrice = document.querySelector('#trade-price');
const tradeSubmit = document.querySelector('#trade-submit');
const tradeListings = document.querySelector('#trade-listings');
const leaveTutorialPanel = document.querySelector('#leave-tutorial-panel');
const leaveTutorialButton = document.querySelector('#leave-tutorial-button');
const formalBirthPanel = document.querySelector('#formal-birth-panel');
const formalBirthForm = document.querySelector('#formal-birth-form');
const formalCharacterName = document.querySelector('#formal-character-name');
const birthLocation = document.querySelector('#birth-location');
const birthLocationDescription = document.querySelector('#birth-location-description');
const characterHeading = document.querySelector('#character-heading');
const mobileGameNav = document.querySelector('#mobile-game-nav');
const mobileTabButtons = [...document.querySelectorAll('[data-mobile-tab]')];

let view = null;
let busy = false;
let pendingAction = readPendingAction(globalThis.sessionStorage);
let formalBirthOptions = [];
let tutorialNameForFormalBirth = '';
let activeMobileTab = 'actions';
const pageBySurface = { travel: 0, dialogue: 0, actions: 0, trade: 0, character: 0 };
const ACTION_PAGE_SIZE = 4;
const CHARACTER_PAGE_SIZE = 8;
const TRADE_PAGE_SIZE = 2;

function requestId() {
  return crypto.randomUUID();
}

function actionKey(action) {
  return JSON.stringify(action);
}

function renderRecovery(text = '') {
  recoveryPanel.hidden = !pendingAction;
  if (pendingAction) {
    recoveryText.textContent = text || '上一個動作的伺服器結果尚未確認。系統會沿用原本的請求編號重新確認，不會建立第二個動作。';
  }
}

function setPendingAction(next) {
  if (next) {
    pendingAction = rememberPendingAction(globalThis.sessionStorage, next);
  } else {
    pendingAction = null;
    forgetPendingAction(globalThis.sessionStorage);
  }
  renderRecovery();
}

function renderBirthLocationDescription() {
  if (!birthLocationDescription || !birthLocation) return;
  const selected = formalBirthOptions.find((option) => option.id === birthLocation.value);
  birthLocationDescription.textContent = selected?.description ?? '';
}

async function showFormalBirth() {
  if (!onboardingMode) return;
  birthPanel.hidden = true;
  gamePanel.hidden = true;
  leaveTutorialPanel.hidden = true;
  formalBirthPanel.hidden = false;
  try {
    const result = await act('life.observe-birth-options', {}, { trackUncertainty: false });
    if (!result) return;
    formalBirthOptions = Array.isArray(result.data?.options) ? result.data.options : [];
    birthLocation.replaceChildren(...formalBirthOptions.map((option) => {
      const element = document.createElement('option');
      element.value = option.id;
      element.textContent = option.name;
      return element;
    }));
    if (tutorialNameForFormalBirth && !formalCharacterName.value) formalCharacterName.value = tutorialNameForFormalBirth;
    renderBirthLocationDescription();
    showMessage(formalBirthOptions.length > 0 ? '新手村教學資料已丟棄。請確認正式姓名與出生地。' : '目前沒有可用的出生地。');
  } catch (error) {
    showMessage(formatActionResult(error.result ?? { ok: false }, '讀取出生地'));
  }
}

async function act(type, payload = {}, { trackUncertainty = true } = {}) {
  if (busy) return null;
  const action = { type, payload };
  const key = actionKey(action);
  if (pendingAction && pendingAction.key !== key) {
    const result = { ok: false, code: 'ACTION_CONFIRMATION_REQUIRED' };
    throw Object.assign(new Error(result.code), { result });
  }

  const currentRequestId = pendingAction?.requestId ?? requestId();
  busy = true;
  document.querySelectorAll('button').forEach((button) => { button.disabled = true; });
  try {
    const outcome = await postActionWithRecovery({
      requestId: currentRequestId,
      action,
    });
    if (outcome.confirmed) {
      if (pendingAction?.key === key) setPendingAction(null);
    } else if (trackUncertainty) {
      setPendingAction({ requestId: currentRequestId, action });
    }
    if (!outcome.result.ok) throw Object.assign(new Error(outcome.result.code), { result: outcome.result });
    return outcome.result;
  } finally {
    busy = false;
    document.querySelectorAll('button').forEach((button) => { button.disabled = false; });
  }
}

async function refresh() {
  try {
    // Scene observation has no player-authored world mutation. A lost scene response
    // must not create a pending action that the UI has no button to reconcile.
    const result = await act('narrative.scene', {}, { trackUncertainty: false });
    if (!result) return;
    view = result.data;
    render();
  } catch (error) {
    if (onboardingMode && error.result?.code === 'FORMAL_BIRTH_PENDING') {
      await showFormalBirth();
      return;
    }
    if (error.result?.code === 'NO_ACTIVE_CHARACTER') {
      if (formalBirthPanel) formalBirthPanel.hidden = true;
      if (leaveTutorialPanel) leaveTutorialPanel.hidden = true;
      birthPanel.hidden = false;
      gamePanel.hidden = true;
      return;
    }
    showMessage(formatActionResult(error.result ?? { ok: false }, '讀取世界'));
  }
}

async function recoverPendingAction() {
  if (!pendingAction) return true;
  const action = pendingAction.action;
  try {
    const result = await act(action.type, action.payload);
    if (result) showMessage(formatActionResult(result, '上一個動作'));
  } catch (error) {
    const text = formatActionResult(error.result ?? { ok: false }, '上一個動作');
    showMessage(text);
    if (pendingAction) {
      renderRecovery(text);
      return false;
    }
  }
  renderRecovery();
  return pendingAction === null;
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
      const text = formatActionResult(error.result ?? { ok: false }, label);
      showMessage(text);
      if (pendingAction) renderRecovery(text);
    }
  });
  return element;
}

function makePager(surface, page, pageCount) {
  const pager = document.createElement('div');
  pager.className = 'pager';
  const previous = document.createElement('button');
  previous.type = 'button';
  previous.className = 'secondary';
  previous.textContent = '上一頁';
  previous.disabled = page <= 0;
  previous.addEventListener('click', () => { pageBySurface[surface] = Math.max(0, page - 1); render(); });
  const label = document.createElement('span');
  label.textContent = `${page + 1} / ${pageCount}`;
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'secondary';
  next.textContent = '下一頁';
  next.disabled = page >= pageCount - 1;
  next.addEventListener('click', () => { pageBySurface[surface] = Math.min(pageCount - 1, page + 1); render(); });
  pager.append(previous, label, next);
  return pager;
}

function renderPagedButtons(container, choices, surface, mapper) {
  const pageCount = Math.max(1, Math.ceil(choices.length / ACTION_PAGE_SIZE));
  const page = Math.min(pageBySurface[surface] ?? 0, pageCount - 1);
  pageBySurface[surface] = page;
  const visible = choices.slice(page * ACTION_PAGE_SIZE, (page + 1) * ACTION_PAGE_SIZE);
  const nodes = visible.map(mapper);
  if (pageCount > 1) nodes.push(makePager(surface, page, pageCount));
  container.replaceChildren(...nodes);
}

function renderTrade() {
  if (!shouldShowTradePanel(view.trade)) {
    tradePanel.hidden = true;
    return;
  }

  tradePanel.hidden = false;
  const sellables = view.trade.sellables ?? [];
  const listings = view.trade.listings ?? [];
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

  const pageCount = Math.max(1, Math.ceil(listings.length / TRADE_PAGE_SIZE));
  const page = Math.min(pageBySurface.trade, pageCount - 1);
  pageBySurface.trade = page;
  const visibleListings = listings.slice(page * TRADE_PAGE_SIZE, (page + 1) * TRADE_PAGE_SIZE);
  const listingNodes = visibleListings.map((listing) => {
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
  if (pageCount > 1) listingNodes.push(makePager('trade', page, pageCount));
  tradeListings.replaceChildren(...listingNodes);
}


function syncMobileTabs() {
  if (!mobileGameNav) return;
  const availability = {
    scene: true,
    travel: !travelPanel.hidden,
    dialogue: !dialoguePanel.hidden,
    actions: !utilityPanel.hidden,
    trade: !tradePanel.hidden,
    character: true,
  };
  activeMobileTab = chooseMobileTab(activeMobileTab, availability);
  gamePanel.dataset.mobileTab = activeMobileTab;
  for (const tabButton of mobileTabButtons) {
    const tab = tabButton.dataset.mobileTab;
    tabButton.hidden = availability[tab] === false;
    tabButton.setAttribute('aria-pressed', String(tab === activeMobileTab));
  }
}

function render() {
  birthPanel.hidden = true;
  if (formalBirthPanel) formalBirthPanel.hidden = true;
  if (leaveTutorialPanel) leaveTutorialPanel.hidden = !(onboardingMode && view.onboarding?.phase === 'tutorial');
  if (characterHeading) characterHeading.textContent = view.onboarding?.phase === 'tutorial' ? '教學 Avatar' : '角色';
  gamePanel.hidden = false;
  locationName.textContent = view.location.name;
  locationDescription.textContent = view.location.description;
  const displayedNarrative = narrativeTextForDisplay(view.location.description, view.narrative.text);
  narrativeText.textContent = displayedNarrative;
  narrativeText.hidden = displayedNarrative.length === 0;

  characterState.replaceChildren();
  const rows = buildCharacterSummaryRows(view);
  const characterPageCount = Math.max(1, Math.ceil(rows.length / CHARACTER_PAGE_SIZE));
  const characterPage = Math.min(pageBySurface.character, characterPageCount - 1);
  pageBySurface.character = characterPage;
  const visibleRows = rows.slice(characterPage * CHARACTER_PAGE_SIZE, (characterPage + 1) * CHARACTER_PAGE_SIZE);
  for (const [key, value] of visibleRows) {
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = key;
    dd.textContent = value;
    characterState.append(dt, dd);
  }
  characterPager.hidden = characterPageCount <= 1;
  if (characterPageCount > 1) characterPager.replaceChildren(...makePager('character', characterPage, characterPageCount).children);

  narrativeActions.replaceChildren(...view.narrative.options.map((choice) => button(choice.label, choice.intent.type, choice.intent.payload)));
  const travelOptions = Array.isArray(view.travelOptions) ? view.travelOptions : [];
  travelPanel.hidden = travelOptions.length === 0;
  renderPagedButtons(travelActions, travelOptions, 'travel', (choice) => button(choice.label, choice.intent.type, choice.intent.payload));
  const dialogueTopics = Array.isArray(view.dialogueTopics) ? view.dialogueTopics : [];
  dialoguePanel.hidden = dialogueTopics.length === 0;
  renderPagedButtons(dialogueActions, dialogueTopics, 'dialogue', (topic) => button(topic.label, topic.intent.type, topic.intent.payload, true));
  const utilities = Array.isArray(view.utilities) ? view.utilities : [];
  utilityPanel.hidden = !shouldShowUtilityPanel(utilities);
  renderPagedButtons(worldActions, utilities, 'actions', (utility) => button(utility.label, utility.intent.type, utility.intent.payload, true));
  renderTrade();
  syncMobileTabs();
}

function showMessage(text) {
  message.textContent = text;
}

birthForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = document.querySelector('#character-name').value;
  try {
    await act('character.birth', { name });
    if (onboardingMode) tutorialNameForFormalBirth = name;
    showMessage(tutorialMode ? '教學 Avatar 已建立。' : '角色已出生。');
    await refresh();
  } catch (error) {
    const text = formatActionResult(error.result ?? { ok: false }, tutorialMode ? '開始教學' : '出生');
    showMessage(text);
    if (pendingAction) renderRecovery(text);
  }
});

if (leaveTutorialButton) {
  leaveTutorialButton.addEventListener('click', async () => {
    tutorialNameForFormalBirth = view?.character?.name ?? tutorialNameForFormalBirth;
    try {
      const result = await act('onboarding.leave-tutorial', { confirmDiscard: true });
      if (!result) return;
      view = null;
      showMessage('已離開新手村；教學資料不會帶入正式人生。');
      await showFormalBirth();
    } catch (error) {
      const text = formatActionResult(error.result ?? { ok: false }, '離開新手村');
      showMessage(text);
      if (pendingAction) renderRecovery(text);
    }
  });
}

if (birthLocation) birthLocation.addEventListener('change', renderBirthLocationDescription);

if (formalBirthForm) {
  formalBirthForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const selected = formalBirthOptions.find((option) => option.id === birthLocation.value);
    if (!selected) {
      showMessage('目前沒有可用的出生地。');
      return;
    }
    try {
      const result = await act('life.formal-birth', {
        name: formalCharacterName.value,
        birthLocationId: selected.id,
      });
      if (!result) return;
      tutorialNameForFormalBirth = '';
      formalBirthPanel.hidden = true;
      showMessage('正式人生已開始。');
      await refresh();
    } catch (error) {
      const text = formatActionResult(error.result ?? { ok: false }, '正式出生');
      showMessage(text);
      if (pendingAction) renderRecovery(text);
    }
  });
}

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
    const text = formatActionResult(error.result ?? { ok: false }, '上架寄售');
    showMessage(text);
    if (pendingAction) renderRecovery(text);
  }
});

for (const tabButton of mobileTabButtons) {
  tabButton.addEventListener('click', () => {
    activeMobileTab = tabButton.dataset.mobileTab;
    syncMobileTabs();
  });
}

recoveryButton.addEventListener('click', async () => {
  const resolved = await recoverPendingAction();
  if (resolved) await refresh();
});

async function start() {
  renderRecovery();
  if (pendingAction) {
    const resolved = await recoverPendingAction();
    if (!resolved) return;
  }
  await refresh();
}

start();
