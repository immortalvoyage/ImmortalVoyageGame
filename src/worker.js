import { createWorkerCharacterService } from './modules/character/index.js';

const COOKIE_NAME = "iv_game_session";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/") return Response.redirect(`${url.origin}/game`, 302);
    if (request.method === "GET" && url.pathname === "/game") return html(entryPage());
    if (request.method === "GET" && url.pathname === "/auth/discord") return startDiscordLogin(url, env);
    if (request.method === "GET" && url.pathname === "/auth/callback") return finishDiscordLogin(request, url, env);
    if (request.method === "GET" && url.pathname === "/play") return protectedGamePage(request, env);
    if (request.method === "POST" && url.pathname === "/character/birth") return createBirthCharacter(request, env);

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
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri
    })
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
  try {
    await createWorkerCharacterService(env).create(userId, { originPreference });
    return Response.redirect(new URL('/play', request.url).toString(), 303);
  } catch (error) {
    return html(messagePage("降生失敗", error instanceof Error ? error.message : "角色建立失敗。"), 400);
  }
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
  return shell(`<main class="hero"><div class="seal">仙遊者</div><p class="eyebrow">IMMORTALVOYAGE</p><h1>不朽之旅</h1><p class="subtitle">一念入世，一念成仙。你的故事，將由此開始。</p><div class="mist"></div><a class="button" href="/auth/discord">以 Discord 登入</a><p class="notice">封閉測試 · 僅限指定帳號</p></main>`);
}

function characterCreationPage() {
  const choices = [
    ['random', '聽天由命', '不指定方向，讓命數決定你的出生之地。'],
    ['coast', '逐海而生', '較容易出生於沿海地域，但並不保證。'],
    ['forest', '近山林野', '較容易出生於林野地域，但並不保證。'],
    ['grassland', '逐水草而居', '較容易出生於草原地域，但並不保證。'],
  ];
  return shell(`<main class="hero birth"><p class="eyebrow">IMMORTALVOYAGE</p><h1>此世未生</h1><p class="subtitle">你無法選擇真正的出生地，只能讓命數稍微聽見你的願望。</p><form method="post" action="/character/birth" class="choices">${choices.map(([value,title,text], index) => `<label class="choice"><input type="radio" name="originPreference" value="${value}" ${index === 0 ? 'checked' : ''}><span><strong>${title}</strong><small>${text}</small></span></label>`).join('')}<button class="button" type="submit">降生此世</button></form><p class="notice">人物屬性、天賦與實際出生地域將於降生時隨機決定。</p></main>`);
}

function gamePage(character) {
  const region = escapeHtml(character?.birthRegionId ?? '未知');
  const talents = Array.isArray(character?.talents) ? character.talents.map((talent) => escapeHtml(talent.id ?? talent)).join('、') : '未知';
  return shell(`<main class="hero"><p class="eyebrow">IMMORTALVOYAGE</p><h1>初臨人世</h1><p class="subtitle">命數已定。你出生於 <strong>${region}</strong>。<br>天賦：${talents || '無'}<br>此角色已寫入世界存檔，重新登入仍會回到此身。</p></main>`);
}

function messagePage(title, message) {
  return shell(`<main class="hero"><p class="eyebrow">IMMORTALVOYAGE</p><h1>${escapeHtml(title)}</h1><p class="subtitle">${escapeHtml(message)}</p><a class="button" href="/game">返回入口</a></main>`);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function shell(content) {
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>ImmortalVoyage 不朽之旅</title><style>
  *{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#07100f;color:#eee7d5;font-family:"Noto Serif TC","Microsoft JhengHei",serif}body{min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 50% 20%,#24372f 0,#0d1916 36%,#050a09 76%)}body:before,body:after{content:"";position:fixed;border:1px solid rgba(205,174,102,.18);inset:22px;pointer-events:none}body:after{inset:30px;border-color:rgba(205,174,102,.07)}.hero{position:relative;width:min(92vw,1050px);min-height:min(88vh,760px);padding:72px 40px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.seal{position:absolute;top:8%;right:8%;writing-mode:vertical-rl;border:1px solid rgba(194,70,54,.5);color:#bd6658;padding:10px 7px;letter-spacing:.2em}.eyebrow{letter-spacing:.5em;font-size:12px;color:#b7a77e;margin:0 0 22px}h1{font-weight:400;font-size:clamp(46px,8vw,92px);letter-spacing:.16em;margin:0;text-shadow:0 8px 40px #000}.subtitle{max-width:680px;font-size:clamp(15px,2vw,20px);line-height:2;color:#c9c2af;margin:28px 0 38px}.button{display:inline-block;text-decoration:none;color:#f3ead3;border:1px solid rgba(210,184,119,.5);padding:15px 34px;letter-spacing:.14em;background:rgba(13,22,19,.72);font:inherit;cursor:pointer}.notice{font-size:12px;letter-spacing:.12em;color:#77776d;margin-top:20px}.mist{height:1px;width:min(65vw,480px);background:linear-gradient(90deg,transparent,rgba(209,186,127,.45),transparent);margin-bottom:34px}.choices{width:min(100%,680px);display:grid;gap:12px}.choice{display:block;text-align:left;cursor:pointer}.choice input{position:absolute;opacity:0}.choice span{display:block;border:1px solid rgba(210,184,119,.22);padding:16px 20px;background:rgba(7,16,15,.6)}.choice strong,.choice small{display:block}.choice strong{font-weight:400;letter-spacing:.12em;color:#eee7d5}.choice small{margin-top:7px;line-height:1.6;color:#999589}.choice input:checked+span{border-color:rgba(210,184,119,.7);background:rgba(194,164,91,.1);box-shadow:inset 0 0 30px rgba(194,164,91,.04)}.choices .button{margin-top:14px}.birth{padding-top:48px;padding-bottom:48px}@media(max-width:600px){body:before{inset:10px}body:after{inset:16px}.hero{width:100%;min-height:100svh;padding:52px 24px}h1{font-size:clamp(42px,15vw,64px)}.subtitle{font-size:15px;margin:22px 0 28px}.button{width:100%}.choice span{padding:14px 16px}}
  </style></head><body>${content}</body></html>`;
}
