import { createWorkerCharacterService } from './modules/character/index.js';
import { applyFirstPlayableAction, getFirstPlayableScene } from './core/first-playable-scene.js';
import { acceptStarterWork, completeStarterWork, getStarterWorkOffers } from './core/starter-work.js';

const COOKIE_NAME = "iv_game_session";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/") return Response.redirect(`${url.origin}/game`, 302);
    if (request.method === "GET" && url.pathname === "/game") return html(entryPage());
    if (request.method === "GET" && url.pathname === "/auth/discord") return startDiscordLogin(url, env);
    if (request.method === "GET" && url.pathname === "/auth/callback") return finishDiscordLogin(request, url, env);
    if (request.method === "GET" && url.pathname === "/play") return protectedGamePage(request, env);
    if (request.method === "GET" && url.pathname === "/work") return starterWorkRoute(request, env);
    if (request.method === "POST" && url.pathname === "/character/birth") return createBirthCharacter(request, env);
    if (request.method === "POST" && url.pathname === "/scene/action") return firstSceneAction(request, env);
    if (request.method === "POST" && url.pathname === "/work/accept") return acceptStarterWorkRoute(request, env);
    if (request.method === "POST" && url.pathname === "/work/complete") return completeStarterWorkRoute(request, env);
    return new Response("Not Found", { status: 404 });
  }
};

function startDiscordLogin(url, env) {
  const callback = `${url.origin}/auth/callback`;
  const authorize = new URL("https://discord.com/oauth2/authorize");
  authorize.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("redirect_uri", callback);
  authorize.searchParams.set("scope", "identify");
  return Response.redirect(authorize.toString(), 302);
}

async function finishDiscordLogin(request, url, env) {
  const code = url.searchParams.get("code");
  if (!code || !env.DISCORD_CLIENT_SECRET) return html(messagePage("登入失敗", "Discord OAuth 尚未完成設定。"), 503);
  const redirectUri = `${url.origin}/auth/callback`;
  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET, grant_type: "authorization_code", code, redirect_uri: redirectUri })
  });
  if (!tokenResponse.ok) return html(messagePage("登入失敗", "Discord 驗證未通過。"), 401);
  const token = await tokenResponse.json();
  const userResponse = await fetch("https://discord.com/api/users/@me", { headers: { Authorization: `Bearer ${token.access_token}` } });
  if (!userResponse.ok) return html(messagePage("登入失敗", "無法取得 Discord 身分。"), 401);
  const user = await userResponse.json();
  if (String(user.id) !== String(env.ALLOWED_DISCORD_USER_ID)) return html(messagePage("封閉測試中", "此 Discord 帳號目前沒有《不朽之旅》測試資格。"), 403);
  const session = await signSession(String(user.id), env.DISCORD_CLIENT_SECRET);
  return new Response(null, { status: 302, headers: { Location: "/play", "Set-Cookie": `${COOKIE_NAME}=${session}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800` } });
}

async function authenticatedUserId(request, env) {
  const session = readCookie(request.headers.get("Cookie"), COOKIE_NAME);
  const userId = session && env.DISCORD_CLIENT_SECRET ? await verifySession(session, env.DISCORD_CLIENT_SECRET) : null;
  return userId === String(env.ALLOWED_DISCORD_USER_ID) ? userId : null;
}

async function protectedGamePage(request, env) {
  const userId = await authenticatedUserId(request, env);
  if (!userId) return Response.redirect(new URL("/game", request.url).toString(), 302);
  if (!env.DB) return html(messagePage("旅途暫停", "角色資料庫尚未完成綁定。"), 503);
  const result = await createWorkerCharacterService(env).resolve(userId);
  if (result.state === 'character_creation_required') return html(characterCreationPage());
  return html(gamePage(result.character));
}

async function createBirthCharacter(request, env) {
  const userId = await authenticatedUserId(request, env);
  if (!userId) return Response.redirect(new URL("/game", request.url).toString(), 303);
  if (!env.DB) return html(messagePage("旅途暫停", "角色資料庫尚未完成綁定。"), 503);
  const form = await request.formData();
  const originPreference = String(form.get('originPreference') || 'random');
  const characterName = String(form.get('characterName') || '');
  try {
    await createWorkerCharacterService(env).create(userId, { originPreference, characterName });
    return Response.redirect(new URL('/play', request.url).toString(), 303);
  } catch (error) {
    return html(messagePage("降生失敗", characterCreationErrorMessage(error)), 400);
  }
}

async function firstSceneAction(request, env) {
  const userId = await authenticatedUserId(request, env);
  if (!userId) return Response.redirect(new URL("/game", request.url).toString(), 303);
  if (!env.DB) return html(messagePage("旅途暫停", "角色資料庫尚未完成綁定。"), 503);
  const service = createWorkerCharacterService(env);
  const resolved = await service.resolve(userId);
  if (resolved.state === 'character_creation_required') return Response.redirect(new URL('/play', request.url).toString(), 303);
  const form = await request.formData();
  try {
    const applied = applyFirstPlayableAction(resolved.character, form.get('actionId'));
    const savedCharacter = await service.save(applied.character);
    if (applied.outcome.actionId === 'seek-work') return Response.redirect(new URL('/work', request.url).toString(), 303);
    return html(sceneResultPage(savedCharacter, applied.outcome));
  } catch (error) {
    if (error?.code === 'unsupported_scene_action') return html(messagePage('行動無效', '這個行動不屬於目前情境。'), 400);
    throw error;
  }
}

async function starterWorkRoute(request, env) {
  const userId = await authenticatedUserId(request, env);
  if (!userId) return Response.redirect(new URL('/game', request.url).toString(), 302);
  if (!env.DB) return html(messagePage('旅途暫停', '角色資料庫尚未完成綁定。'), 503);
  const resolved = await createWorkerCharacterService(env).resolve(userId);
  if (resolved.state === 'character_creation_required') return Response.redirect(new URL('/play', request.url).toString(), 302);
  return html(starterWorkPage(resolved.character));
}

async function acceptStarterWorkRoute(request, env) {
  const userId = await authenticatedUserId(request, env);
  if (!userId) return Response.redirect(new URL('/game', request.url).toString(), 303);
  if (!env.DB) return html(messagePage('旅途暫停', '角色資料庫尚未完成綁定。'), 503);
  const service = createWorkerCharacterService(env);
  const resolved = await service.resolve(userId);
  if (resolved.state === 'character_creation_required') return Response.redirect(new URL('/play', request.url).toString(), 303);
  const form = await request.formData();
  try {
    const updated = acceptStarterWork(resolved.character, form.get('workId'));
    await service.save(updated);
    return Response.redirect(new URL('/work', request.url).toString(), 303);
  } catch (error) {
    if (error?.code === 'active_work_exists') return html(messagePage('已有工作', '你目前已有一份尚未完成的工作。'), 409);
    if (error?.code === 'unsupported_starter_work') return html(messagePage('工作無效', '這份工作目前不存在。'), 400);
    throw error;
  }
}

async function completeStarterWorkRoute(request, env) {
  const userId = await authenticatedUserId(request, env);
  if (!userId) return Response.redirect(new URL('/game', request.url).toString(), 303);
  if (!env.DB) return html(messagePage('旅途暫停', '角色資料庫尚未完成綁定。'), 503);
  const service = createWorkerCharacterService(env);
  const resolved = await service.resolve(userId);
  if (resolved.state === 'character_creation_required') return Response.redirect(new URL('/play', request.url).toString(), 303);
  try {
    const updated = completeStarterWork(resolved.character);
    await service.save(updated);
    return Response.redirect(new URL('/work', request.url).toString(), 303);
  } catch (error) {
    if (error?.code === 'no_active_work') return html(messagePage('沒有工作', '目前沒有可以結算的工作。'), 409);
    throw error;
  }
}

function characterCreationErrorMessage(error) {
  const messages = {
    name_required: '請先為此世取一個名字。', name_too_short: '名字至少需要 2 個字元。', name_too_long: '名字最多 24 個可視字元。',
    name_invalid_characters: '名字只能使用各語言文字與常見姓名分隔符號。', name_forbidden_format: '名字包含不可使用的隱藏或控制字元。', name_reserved: '這個名字屬於系統或官方保留名稱，請換一個名字。',
  };
  return messages[error?.code] ?? (error instanceof Error ? error.message : '角色建立失敗。');
}

async function signSession(userId, secret) {
  const expires = Date.now() + 8 * 60 * 60 * 1000;
  const payload = `${userId}.${expires}`;
  const signature = await hmac(payload, secret);
  return `${payload}.${signature}`;
}

async function verifySession(value, secret) {
  const parts = String(value).split(".");
  if (parts.length !== 3) return null;
  const [userId, expires, signature] = parts;
  if (Number(expires) < Date.now()) return null;
  const expected = await hmac(`${userId}.${expires}`, secret);
  return timingSafeEqual(signature, expected) ? userId : null;
}

async function hmac(value, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function readCookie(header, name) {
  for (const item of String(header || "").split(";")) {
    const [key, ...rest] = item.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

function html(body, status = 200) {
  return new Response(body, { status, headers: { "Content-Type": "text/html; charset=UTF-8", "Cache-Control": "no-store" } });
}

function entryPage() {
  return shell(`<main class="hero entrance"><div class="seal">仙遊者</div><div class="entrance-halo"></div><p class="eyebrow">IMMORTALVOYAGE</p><p class="brand-mark">仙遊者</p><h1>不朽之旅</h1><p class="subtitle entrance-copy">一念入世，一念成仙。<br>你的故事，將由此開始。</p><p class="world-promise">你的選擇會留下痕跡，而世界不會為任何人停下。</p><div class="mist"></div><a class="button primary" href="/auth/discord"><span>進入不朽之旅</span><small>使用 Discord 身分登入</small></a><p class="notice entrance-notice">封閉測試 · TEST BUILD</p></main>`);
}

function characterCreationPage() {
  const choices = [
    ['random', '◌', '聽天由命', '不指定方向，讓命數決定出生之地。'],
    ['coast', '≈', '逐海而生', '較容易出生於沿海地域，但不保證。'],
    ['forest', '⌃', '近山林野', '較容易出生於林野地域，但不保證。'],
    ['grassland', '〰', '逐水草而居', '較容易出生於草原地域，但不保證。'],
  ];
  return shell(`<main class="hero birth"><div class="birth-frame"><div class="birth-heading"><p class="eyebrow">IMMORTALVOYAGE · 命冊</p><h1>此世未生</h1><p class="subtitle">天地尚未記下你的名字。你無法選擇真正的出生地，只能讓命數稍微聽見你的願望。</p></div><form method="post" action="/character/birth" class="choices"><label class="name-field"><span>此世姓名</span><div class="name-input-wrap"><input name="characterName" type="text" minlength="2" maxlength="48" autocomplete="off" required placeholder="沈無涯 / Johann Müller / Élodie"><i>名</i></div><small>支援世界各地常見文字 · 2～24 個可視字元 · 不要求全球唯一</small></label><p class="choice-title">出生願望 <small>僅影響傾向，不保證實際出生地域</small></p><div class="choice-grid">${choices.map(([value,icon,title,text], index) => `<label class="choice"><input type="radio" name="originPreference" value="${value}" ${index === 0 ? 'checked' : ''}><span><b>${icon}</b><strong>${title}</strong><small>${text}</small></span></label>`).join('')}</div><button class="button primary birth-submit" type="submit"><span>降生此世</span><small>人物屬性與天賦將在此刻決定</small></button></form><p class="notice">一旦降生，此世便開始流動。</p></div></main>`);
}

function gamePage(character) {
  const name = escapeHtml(character?.name ?? '無名之人');
  const scene = getFirstPlayableScene(character);
  const persistedResult = character?.sceneState?.sceneId === scene.id && character.sceneState.lastResult
    ? `<div class="scene-memory"><strong>你記得方才：</strong>${escapeHtml(character.sceneState.lastResult)}</div>`
    : '';
  const historyCount = Array.isArray(character?.actionHistory) ? character.actionHistory.length : 0;
  const workLink = character?.activeWorkContract ? `<a class="button secondary" href="/work">查看目前工作</a>` : '';
  return shell(`<main class="hero play-scene"><p class="eyebrow">IMMORTALVOYAGE</p><p class="scene-name">${name}</p><h1>${escapeHtml(scene.title)}</h1><p class="subtitle">${escapeHtml(scene.body)}</p>${persistedResult}<form method="post" action="/scene/action" class="scene-actions">${scene.choices.map((choice) => `<button class="scene-choice" type="submit" name="actionId" value="${escapeHtml(choice.id)}">${escapeHtml(choice.label)}</button>`).join('')}</form>${workLink}<p class="notice">此情境已有 ${historyCount} 筆行動寫入角色存檔；重新登入仍會保留。</p></main>`);
}

function sceneResultPage(character, outcome) {
  const name = escapeHtml(character?.name ?? '無名之人');
  const historyCount = Array.isArray(character?.actionHistory) ? character.actionHistory.length : 0;
  return shell(`<main class="hero play-scene"><p class="eyebrow">IMMORTALVOYAGE</p><p class="scene-name">${name}</p><h1>此行有果</h1><p class="subtitle">${escapeHtml(outcome.result)}</p><a class="button" href="/play">回到眼前</a><p class="notice">此行已寫入角色存檔，目前共保存 ${historyCount} 筆情境行動。</p></main>`);
}

function provisionLabel(value) {
  return ({ employer: '雇主提供', worker: '自行負擔', shared: '共同供應', reimbursed: '事後報銷', notProvided: '不提供' })[value] ?? String(value || '未標示');
}

export function starterWorkPage(character) {
  const name = escapeHtml(character?.name ?? '無名之人');
  const copper = Number(character?.economy?.balances?.copper) || 0;
  const active = character?.activeWorkContract;
  const historyCount = Array.isArray(character?.workHistory) ? character.workHistory.length : 0;
  if (active) {
    return shell(`<main class="hero work-page"><p class="eyebrow">IMMORTALVOYAGE</p><p class="scene-name">${name}</p><h1>今日有工</h1><div class="work-card active-work"><h2>${escapeHtml(active.title)}</h2><p class="work-pay">報酬 ${active.pay} 銅</p><dl><div><dt>伙食</dt><dd>${escapeHtml(provisionLabel(active.provisions?.food))}</dd></div><div><dt>飲水</dt><dd>${escapeHtml(provisionLabel(active.provisions?.water))}</dd></div><div><dt>住宿</dt><dd>${escapeHtml(provisionLabel(active.provisions?.lodging))}</dd></div></dl><form method="post" action="/work/complete"><button class="button" type="submit">完成這份工作</button></form></div><p class="notice">目前持有 ${copper} 銅；完成後由伺服器驗證並結算報酬。</p><a class="text-link" href="/play">返回眼前</a></main>`);
  }
  const offers = getStarterWorkOffers(character);
  return shell(`<main class="hero work-page"><p class="eyebrow">IMMORTALVOYAGE</p><p class="scene-name">${name}</p><h1>找份活做</h1><p class="subtitle compact">能做的事不多，但至少能換來第一筆收入。待遇在接下之前都寫得清楚。</p><div class="work-grid">${offers.map((offer) => `<article class="work-card"><h2>${escapeHtml(offer.title)}</h2><p class="work-pay">${offer.pay} 銅</p><dl><div><dt>伙食</dt><dd>${escapeHtml(provisionLabel(offer.provisions.food))}</dd></div><div><dt>飲水</dt><dd>${escapeHtml(provisionLabel(offer.provisions.water))}</dd></div><div><dt>住宿</dt><dd>${escapeHtml(provisionLabel(offer.provisions.lodging))}</dd></div></dl><form method="post" action="/work/accept"><button class="scene-choice" type="submit" name="workId" value="${escapeHtml(offer.id)}">接下這份工作</button></form></article>`).join('')}</div><p class="notice">目前持有 ${copper} 銅 · 已完成 ${historyCount} 份工作。</p><a class="text-link" href="/play">先不工作</a></main>`);
}

function messagePage(title, message) {
  return shell(`<main class="hero"><p class="eyebrow">IMMORTALVOYAGE</p><h1>${escapeHtml(title)}</h1><p class="subtitle">${escapeHtml(message)}</p><a class="button" href="/game">返回入口</a></main>`);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function shell(content) {
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>ImmortalVoyage 不朽之旅</title><style>
*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#07100f;color:#eee7d5;font-family:"Noto Serif TC","Microsoft JhengHei",serif}body{min-height:100vh;display:grid;place-items:center;overflow-x:hidden;background:radial-gradient(circle at 50% 15%,rgba(57,84,70,.72) 0,rgba(18,35,29,.86) 27%,#09110f 58%,#040706 100%)}body:before,body:after{content:"";position:fixed;pointer-events:none;z-index:0}body:before{inset:22px;border:1px solid rgba(216,183,105,.22);box-shadow:inset 0 0 80px rgba(0,0,0,.42)}body:after{inset:0;background:linear-gradient(135deg,transparent 0 42%,rgba(205,174,102,.025) 42% 43%,transparent 43% 57%,rgba(205,174,102,.02) 57% 58%,transparent 58%),radial-gradient(ellipse at 50% 115%,rgba(116,101,65,.1),transparent 52%);opacity:.9}.hero{position:relative;z-index:1;width:min(94vw,1120px);min-height:min(90vh,820px);padding:54px 44px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.seal{position:absolute;top:7%;right:7%;writing-mode:vertical-rl;border:1px solid rgba(194,70,54,.62);color:#c97868;padding:12px 9px;font-size:20px;letter-spacing:.2em;box-shadow:0 0 28px rgba(143,48,38,.1)}.eyebrow{letter-spacing:.42em;font-size:18px;color:#b7a77e;margin:0 0 16px}h1{font-weight:400;font-size:clamp(48px,7vw,78px);letter-spacing:.12em;margin:0;text-shadow:0 8px 40px #000}.subtitle{max-width:900px;font-size:clamp(22px,2.2vw,28px);line-height:1.55;color:#c9c2af;margin:20px 0 26px}.subtitle.compact{font-size:21px;margin:14px 0 18px}.button{display:inline-block;text-decoration:none;color:#f3ead3;border:1px solid rgba(210,184,119,.5);padding:15px 30px;letter-spacing:.12em;background:rgba(13,22,19,.72);font:inherit;font-size:22px;cursor:pointer;transition:border-color .16s ease,background .16s ease,transform .16s ease,box-shadow .16s ease}.button:hover,.button:focus{border-color:rgba(232,204,136,.86);background:rgba(38,48,39,.88);box-shadow:0 10px 34px rgba(0,0,0,.24),inset 0 0 24px rgba(220,185,105,.05)}.button.secondary{margin-top:14px;font-size:18px;padding:11px 20px}.button.primary{position:relative;min-width:310px;padding:15px 38px;border-color:rgba(227,195,121,.62);background:linear-gradient(180deg,rgba(47,59,47,.88),rgba(16,27,23,.92));box-shadow:0 14px 40px rgba(0,0,0,.28),inset 0 1px rgba(255,255,255,.05)}.button.primary span,.button.primary small{display:block}.button.primary span{font-size:21px;letter-spacing:.16em}.button.primary small{margin-top:4px;color:#938b77;font-size:12px;letter-spacing:.08em}.notice{font-size:16px;line-height:1.45;letter-spacing:.05em;color:#77776d;margin:14px 0 0}.mist{height:1px;width:min(65vw,520px);background:linear-gradient(90deg,transparent,rgba(225,197,126,.58),transparent);margin-bottom:28px;box-shadow:0 0 24px rgba(210,184,119,.15)}.entrance{min-height:100svh;isolation:isolate}.entrance:before{content:"";position:absolute;inset:8% 8%;z-index:-2;background:linear-gradient(150deg,transparent 0 46%,rgba(209,184,119,.1) 46.2% 46.5%,transparent 46.8%),linear-gradient(25deg,transparent 0 56%,rgba(209,184,119,.07) 56.2% 56.5%,transparent 56.8%);mask-image:linear-gradient(to bottom,transparent,#000 25%,#000 75%,transparent)}.entrance-halo{position:absolute;z-index:-1;width:min(58vw,660px);aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,rgba(202,178,113,.09),rgba(111,137,117,.05) 38%,transparent 66%);filter:blur(2px)}.brand-mark{margin:0 0 4px;color:#d7c38e;font-size:18px;letter-spacing:.5em}.entrance h1{font-size:clamp(58px,8vw,94px);letter-spacing:.18em;background:linear-gradient(180deg,#f3ead3,#c7ad72 74%,#8d794f);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:none;filter:drop-shadow(0 12px 35px rgba(0,0,0,.38))}.entrance-copy{margin:18px 0 12px;font-size:clamp(21px,2vw,27px);letter-spacing:.1em}.world-promise{max-width:620px;margin:0 0 24px;color:#918b79;font-size:15px;letter-spacing:.12em}.entrance-notice{margin-top:18px;color:#655f54;font-size:12px;letter-spacing:.24em}.choices{width:min(100%,900px);display:grid;gap:12px}.choice-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.choice{display:block;text-align:left;cursor:pointer}.choice input{position:absolute;opacity:0}.choice span{position:relative;height:100%;display:grid;grid-template-columns:42px 1fr;grid-template-areas:"icon title" "icon desc";column-gap:12px;border:1px solid rgba(210,184,119,.22);padding:14px 18px;background:linear-gradient(135deg,rgba(12,23,19,.82),rgba(6,13,11,.68));transition:border-color .16s ease,background .16s ease,transform .16s ease,box-shadow .16s ease}.choice b{grid-area:icon;align-self:center;justify-self:center;color:#8f8060;font-size:28px;font-weight:400}.choice strong,.choice small{display:block}.choice strong{grid-area:title;font-size:21px;font-weight:400;letter-spacing:.06em;color:#eee7d5}.choice small{grid-area:desc}.choice small,.name-field small{margin-top:5px;font-size:16px;line-height:1.4;color:#aaa492}.choice:hover span{border-color:rgba(210,184,119,.46);transform:translateY(-1px)}.choice input:checked+span{border-color:rgba(224,193,120,.8);background:linear-gradient(135deg,rgba(61,57,38,.32),rgba(12,24,19,.82));box-shadow:inset 0 0 38px rgba(194,164,91,.06),0 8px 30px rgba(0,0,0,.16)}.choice input:checked+span b{color:#d7bd7e;text-shadow:0 0 16px rgba(215,189,126,.25)}.choices .button{margin-top:2px}.name-field{display:block;text-align:left}.name-field>span{display:block;font-size:19px;margin-bottom:7px;letter-spacing:.12em;color:#d9cda9}.name-input-wrap{position:relative}.name-field input{width:100%;padding:14px 52px 14px 16px;border:1px solid rgba(210,184,119,.35);background:linear-gradient(180deg,rgba(4,10,8,.86),rgba(10,20,17,.76));color:#f3ead3;font:inherit;font-size:20px;outline:none;box-shadow:inset 0 4px 18px rgba(0,0,0,.22)}.name-field input:focus{border-color:rgba(225,194,119,.8);box-shadow:0 0 0 1px rgba(225,194,119,.08),inset 0 4px 18px rgba(0,0,0,.22)}.name-input-wrap i{position:absolute;right:14px;top:50%;translate:0 -50%;width:27px;height:27px;display:grid;place-items:center;border:1px solid rgba(180,75,57,.52);color:#b96556;font-style:normal;font-size:13px}.name-field small{display:block}.choice-title{margin:2px 0 -2px;color:#d9cda9;font-size:17px;letter-spacing:.1em;text-align:left}.choice-title small{margin-left:8px;color:#777468;font-size:13px;letter-spacing:.04em}.birth{width:min(96vw,1020px);height:100svh;min-height:0;padding:18px 28px;justify-content:center;overflow:hidden}.birth-frame{width:100%;max-width:940px;padding:26px 30px;border:1px solid rgba(210,184,119,.22);background:linear-gradient(180deg,rgba(12,24,20,.58),rgba(5,12,10,.48));box-shadow:0 28px 90px rgba(0,0,0,.26),inset 0 0 70px rgba(206,180,111,.025);position:relative}.birth-frame:before,.birth-frame:after{content:"";position:absolute;width:44px;height:44px;border-color:rgba(210,184,119,.5);pointer-events:none}.birth-frame:before{left:-1px;top:-1px;border-left:1px solid;border-top:1px solid}.birth-frame:after{right:-1px;bottom:-1px;border-right:1px solid;border-bottom:1px solid}.birth-heading .eyebrow{font-size:14px;margin-bottom:8px}.birth h1{font-size:clamp(40px,5.5vw,60px)}.birth .subtitle{max-width:780px;margin:8px auto 15px;font-size:clamp(17px,1.75vw,21px);line-height:1.45}.birth-submit{justify-self:center;margin-top:3px!important;min-width:280px}.play-scene{min-height:100svh}.play-scene h1{font-size:clamp(42px,5vw,64px)}.scene-name{margin:0 0 12px;color:#b7a77e;font-size:18px;letter-spacing:.12em}.scene-memory{width:min(100%,760px);margin:0 0 18px;padding:14px 16px;border:1px solid rgba(210,184,119,.22);color:#bdb5a2;font-size:17px;line-height:1.5;text-align:left}.scene-memory strong{color:#d9cda9;font-weight:400}.scene-actions{width:min(100%,760px);display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.scene-choice{min-height:86px;padding:16px;border:1px solid rgba(210,184,119,.35);background:rgba(7,16,15,.62);color:#eee7d5;font:inherit;font-size:20px;cursor:pointer}.scene-choice:hover,.scene-choice:focus{border-color:rgba(210,184,119,.78);background:rgba(194,164,91,.1)}.work-page{min-height:100svh}.work-page h1{font-size:clamp(40px,5vw,60px)}.work-grid{width:min(100%,860px);display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.work-card{border:1px solid rgba(210,184,119,.28);background:rgba(7,16,15,.64);padding:20px;text-align:left}.work-card h2{font-size:24px;font-weight:400;margin:0}.work-pay{font-size:21px;color:#d9cda9;margin:8px 0 14px}.work-card dl{margin:0 0 16px}.work-card dl div{display:flex;justify-content:space-between;gap:16px;padding:5px 0;border-bottom:1px solid rgba(210,184,119,.08)}.work-card dt,.work-card dd{margin:0;font-size:16px}.work-card dt{color:#8f8b7d}.work-card dd{color:#c9c2af}.work-card .scene-choice{width:100%;min-height:54px;font-size:18px;padding:10px}.active-work{width:min(100%,600px);text-align:left}.active-work .button{width:100%;margin-top:6px}.text-link{margin-top:16px;color:#a89e83;text-decoration:none;font-size:16px}.text-link:hover{text-decoration:underline}
@media(max-width:600px){body:before{inset:8px}.hero{width:100%;min-height:100svh;padding:30px 18px}.seal{top:5%;right:6%;font-size:14px;padding:8px 6px}h1{font-size:clamp(42px,13vw,58px)}.eyebrow{font-size:13px;margin-bottom:9px}.subtitle{font-size:19px;line-height:1.48;margin:16px 0 20px}.button{width:100%;font-size:20px;padding:14px 18px}.button.primary{min-width:0}.button.primary span{font-size:19px}.notice{font-size:13px}.entrance h1{font-size:clamp(52px,16vw,72px);letter-spacing:.1em}.brand-mark{font-size:15px}.entrance-copy{font-size:19px;line-height:1.55;margin:14px 0 10px}.world-promise{font-size:12px;line-height:1.6;letter-spacing:.08em;margin-bottom:20px}.entrance .mist{margin-bottom:22px}.birth{height:100svh;padding:10px 12px}.birth-frame{padding:15px 13px}.birth h1{font-size:35px}.birth .subtitle{font-size:14px;line-height:1.4;margin:5px auto 9px}.birth-heading .eyebrow{font-size:11px;margin-bottom:4px}.choices{gap:7px}.choice-title{font-size:14px}.choice-title small{display:block;margin:2px 0 0;font-size:11px}.choice-grid{gap:6px}.choice span{grid-template-columns:30px 1fr;column-gap:7px;padding:8px 9px}.choice b{font-size:20px}.choice strong{font-size:16px}.choice small,.name-field small{font-size:11px;line-height:1.25}.name-field>span{font-size:15px;margin-bottom:4px}.name-field input{font-size:16px;padding:9px 42px 9px 10px}.name-input-wrap i{right:9px;width:24px;height:24px;font-size:11px}.birth-submit{min-width:0}.choices .button{font-size:16px;padding:9px 12px}.choices .button small{font-size:10px}.birth .notice{margin-top:6px;font-size:10px}.play-scene{padding:26px 16px}.play-scene h1{font-size:38px}.play-scene .subtitle{font-size:18px}.scene-memory{font-size:15px;margin-bottom:14px}.scene-actions{grid-template-columns:1fr;gap:8px}.scene-choice{min-height:58px;font-size:18px;padding:12px}.work-page{padding:24px 16px}.work-page h1{font-size:36px}.work-page .subtitle.compact{font-size:17px;line-height:1.4}.work-grid{grid-template-columns:1fr;gap:9px}.work-card{padding:14px}.work-card h2{font-size:21px}.work-pay{font-size:18px;margin:5px 0 9px}.work-card dt,.work-card dd{font-size:14px}.work-card .scene-choice{min-height:48px;font-size:17px}}
</style></head><body>${content}</body></html>`;
}
