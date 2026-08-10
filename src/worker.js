const COOKIE_NAME = "iv_game_session";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "GET") return new Response("Method Not Allowed", { status: 405 });
    if (url.pathname === "/") return Response.redirect(`${url.origin}/game`, 302);
    if (url.pathname === "/game") return html(entryPage());
    if (url.pathname === "/auth/discord") return startDiscordLogin(url, env);
    if (url.pathname === "/auth/callback") return finishDiscordLogin(url, env);
    if (url.pathname === "/play") return protectedGamePage(request, env);
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

async function finishDiscordLogin(url, env) {
  const code = url.searchParams.get("code");
  if (!code || !env.DISCORD_CLIENT_SECRET) return html(messagePage("登入失敗", "Discord OAuth 尚未完成設定。"), 503);
  const redirectUri = `${url.origin}/auth/callback`;
  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET, grant_type: "authorization_code", code, redirect_uri: redirectUri }) });
  if (!tokenResponse.ok) return html(messagePage("登入失敗", "Discord 驗證未通過。"), 401);
  const token = await tokenResponse.json();
  const userResponse = await fetch("https://discord.com/api/users/@me", { headers: { Authorization: `Bearer ${token.access_token}` } });
  if (!userResponse.ok) return html(messagePage("登入失敗", "無法取得 Discord 身分。"), 401);
  const user = await userResponse.json();
  if (String(user.id) !== String(env.ALLOWED_DISCORD_USER_ID)) return html(messagePage("封閉測試中", "此 Discord 帳號目前沒有《不朽之旅》測試資格。"), 403);
  const session = await signSession(String(user.id), env.DISCORD_CLIENT_SECRET);
  return new Response(null, { status: 302, headers: { Location: "/play", "Set-Cookie": `${COOKIE_NAME}=${session}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800` } });
}

async function protectedGamePage(request, env) {
  const session = readCookie(request.headers.get("Cookie"), COOKIE_NAME);
  const userId = session && env.DISCORD_CLIENT_SECRET ? await verifySession(session, env.DISCORD_CLIENT_SECRET) : null;
  if (!userId || userId !== String(env.ALLOWED_DISCORD_USER_ID)) return Response.redirect(new URL("/game", request.url).toString(), 302);
  return html(gamePage(), 200, "game");
}

async function signSession(userId, secret) { const expires = Date.now() + 28800000; const payload = `${userId}.${expires}`; return `${payload}.${await hmac(payload, secret)}`; }
async function verifySession(value, secret) { const parts = String(value).split("."); if (parts.length !== 3) return null; const [userId, expires, signature] = parts; if (Number(expires) < Date.now()) return null; const expected = await hmac(`${userId}.${expires}`, secret); return timingSafeEqual(signature, expected) ? userId : null; }
async function hmac(value, secret) { const encoder = new TextEncoder(); const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))); return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join(""); }
function timingSafeEqual(a,b){ if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0; }
function readCookie(header,name){for(const item of String(header||"").split(";")){const [key,...rest]=item.trim().split("=");if(key===name)return rest.join("=");}return null;}
function html(body,status=200,mode="landing"){return new Response(shell(body,mode),{status,headers:{"Content-Type":"text/html; charset=UTF-8","Cache-Control":"no-store"}});}

function entryPage(){return `<main class="hero"><div class="seal">仙遊者</div><p class="eyebrow">IMMORTALVOYAGE</p><h1>不朽之旅</h1><p class="subtitle">一念入世，一念成仙。你的故事，將由此開始。</p><div class="mist"></div><a class="discord" href="/auth/discord">以 Discord 登入</a><p class="notice">封閉測試 · 僅限指定帳號</p></main>`;}
function messagePage(title,message){return `<main class="hero"><p class="eyebrow">IMMORTALVOYAGE</p><h1>${title}</h1><p class="subtitle">${message}</p><a class="discord" href="/game">返回入口</a></main>`;}

function gamePage(){return `<main class="game-shell">
<header class="game-header"><div><span class="brand-en">IMMORTALVOYAGE</span><strong>不朽之旅</strong></div><div class="chapter">序章 · 未入世</div></header>
<aside class="character panel"><div class="panel-title">旅者</div><div class="avatar-mark">未</div><h2>無名旅者</h2><p class="muted">凡軀 · 尚未踏入修途</p><div class="stats"><span>境界<b>凡人</b></span><span>氣運<b>未定</b></span><span>所在<b>界外</b></span></div><div class="divider"></div><p class="label">當前狀態</p><p>身在迷霧之外，前路尚未顯現。</p></aside>
<section class="scene panel"><div class="scene-head"><span class="panel-title">眼前之境</span><span class="location">無名之境</span></div><div class="scene-art"><div class="moon"></div><div class="mountain m1"></div><div class="mountain m2"></div><span>天地未開 · 萬象待生</span></div><article class="story"><p>你睜開雙眼。</p><p>四周沒有日月，也聽不見風聲。只有一片看不到盡頭的薄霧，在腳下緩慢流動。</p><p>遠方似乎有什麼正在等待著你。</p></article></section>
<aside class="chronicle panel"><div class="panel-title">旅途紀錄</div><div class="log"><time>此刻</time><p>你來到了這個世界。</p></div><div class="log dim"><time>尚未發生</time><p>你的第一個選擇將留在這裡。</p></div></aside>
<section class="action panel"><label for="action-input">你打算做什麼？</label><div class="action-row"><input id="action-input" type="text" placeholder="例如：向前走、觀察四周、呼喊……" disabled><button disabled>行動</button></div><p>遊戲互動系統尚未啟用 · 本階段僅建立主畫面</p></section>
</main>`;}

function shell(content,mode){return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>ImmortalVoyage 不朽之旅</title><style>
*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#07100f;color:#eee7d5;font-family:"Noto Serif TC","Microsoft JhengHei",serif}body{min-height:100vh;background:radial-gradient(circle at 50% 15%,#24372f 0,#0d1916 34%,#050a09 78%)}body:not(.game):before,body:not(.game):after{content:"";position:fixed;border:1px solid rgba(205,174,102,.18);inset:22px;pointer-events:none}body:not(.game):after{inset:30px;border-color:rgba(205,174,102,.07)}.hero{position:relative;width:min(92vw,1050px);min-height:100vh;margin:auto;padding:72px 40px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.hero:before{content:"";position:absolute;width:min(65vw,620px);aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,rgba(188,156,83,.09),transparent 68%);filter:blur(8px);z-index:-1}.seal{position:absolute;top:8%;right:8%;writing-mode:vertical-rl;border:1px solid rgba(194,70,54,.5);color:#bd6658;padding:10px 7px;letter-spacing:.2em}.eyebrow,.brand-en{letter-spacing:.5em;font-size:11px;color:#b7a77e}.hero h1{font-weight:400;font-size:clamp(46px,8vw,92px);letter-spacing:.16em;margin:18px 0 0;text-shadow:0 8px 40px #000}.subtitle{max-width:620px;font-size:clamp(15px,2vw,20px);line-height:2;color:#c9c2af;margin:28px 0 38px}.discord{display:inline-block;text-decoration:none;color:#f3ead3;border:1px solid rgba(210,184,119,.5);padding:15px 34px;letter-spacing:.14em;background:rgba(13,22,19,.72)}.notice{font-size:12px;letter-spacing:.18em;color:#77776d;margin-top:20px}.mist{height:1px;width:min(65vw,480px);background:linear-gradient(90deg,transparent,rgba(209,186,127,.45),transparent);margin-bottom:34px}
.game-shell{width:min(1500px,calc(100vw - 48px));min-height:100vh;margin:auto;padding:24px 0;display:grid;grid-template-columns:260px minmax(420px,1fr) 280px;grid-template-rows:auto 1fr auto;gap:14px}.panel{border:1px solid rgba(196,171,109,.2);background:linear-gradient(145deg,rgba(17,31,27,.92),rgba(6,14,12,.92));box-shadow:0 18px 50px rgba(0,0,0,.22);position:relative;overflow:hidden}.panel:after{content:"";position:absolute;inset:7px;border:1px solid rgba(196,171,109,.05);pointer-events:none}.game-header{grid-column:1/-1;display:flex;align-items:end;justify-content:space-between;border-bottom:1px solid rgba(196,171,109,.22);padding:8px 4px 17px}.game-header strong{display:block;font-size:25px;font-weight:400;letter-spacing:.2em;margin-top:7px}.chapter,.location{font-size:12px;letter-spacing:.18em;color:#9f957b}.character,.chronicle{padding:26px 22px}.panel-title{font-size:13px;letter-spacing:.25em;color:#c3ad73}.avatar-mark{width:72px;height:72px;border:1px solid rgba(196,171,109,.28);border-radius:50%;display:grid;place-items:center;margin:30px auto 16px;font-size:27px;color:#8f8060;background:radial-gradient(circle,#1c2e28,#0a1411)}.character h2{text-align:center;font-weight:400;letter-spacing:.12em;margin:0 0 8px}.muted{color:#777a70;font-size:12px;text-align:center}.stats{display:grid;gap:14px;margin-top:28px}.stats span{display:flex;justify-content:space-between;color:#8e8c80;font-size:12px}.stats b{font-weight:400;color:#d8cfb8}.divider{height:1px;background:linear-gradient(90deg,transparent,rgba(196,171,109,.25),transparent);margin:27px 0}.label{color:#8f8265;font-size:12px;letter-spacing:.15em}.character>p:last-child{font-size:13px;line-height:1.8;color:#aaa698}.scene{display:flex;flex-direction:column}.scene-head{display:flex;justify-content:space-between;padding:22px 25px 15px}.scene-art{height:43%;min-height:230px;position:relative;overflow:hidden;background:linear-gradient(#142923,#0a1613)}.scene-art:after{content:"";position:absolute;inset:0;background:linear-gradient(transparent 55%,#07100f),radial-gradient(circle at 50% 40%,transparent,rgba(0,0,0,.3))}.scene-art span{position:absolute;bottom:20px;left:0;right:0;text-align:center;z-index:3;font-size:11px;letter-spacing:.35em;color:#9c967f}.moon{position:absolute;width:85px;height:85px;border-radius:50%;left:55%;top:16%;background:rgba(225,214,177,.13);box-shadow:0 0 55px rgba(225,214,177,.12)}.mountain{position:absolute;width:70%;height:80%;bottom:-35%;transform:rotate(45deg);background:#0c1c18}.m1{left:-15%}.m2{right:-28%;bottom:-45%;background:#10231e}.story{padding:22px 28px 30px;overflow:auto;font-size:15px;line-height:2;color:#d1cbb9}.story p{margin:0 0 12px}.chronicle .log{border-left:1px solid rgba(196,171,109,.25);padding:0 0 22px 17px;margin-top:27px}.log time{font-size:10px;color:#9f8b5e;letter-spacing:.15em}.log p{font-size:13px;line-height:1.7;color:#bbb4a2}.log.dim{opacity:.42}.action{grid-column:1/-1;padding:17px 22px}.action label{display:block;font-size:12px;letter-spacing:.18em;color:#b7a77e;margin-bottom:10px}.action-row{display:flex;gap:10px}.action input{flex:1;border:1px solid rgba(196,171,109,.18);background:#07100e;color:#d7d0bd;padding:13px 15px;font:inherit;outline:none}.action button{width:100px;border:1px solid rgba(196,171,109,.25);background:#17241f;color:#8c8779;font-family:inherit}.action p{font-size:10px;color:#5e625b;margin:9px 0 0}
@media(max-width:900px){.game-shell{width:min(100% - 22px,720px);padding:12px 0 24px;display:flex;flex-direction:column;min-height:100svh}.game-header{order:0;padding:8px 5px 13px}.game-header strong{font-size:20px}.chapter{font-size:10px}.scene{order:1}.character{order:2}.chronicle{order:3}.action{order:4;position:sticky;bottom:8px;z-index:10;box-shadow:0 -15px 35px rgba(3,8,7,.8)}.scene-art{height:230px}.character{padding:20px}.avatar-mark{margin:18px auto 12px;width:58px;height:58px}.stats{grid-template-columns:repeat(3,1fr);gap:7px}.stats span{display:block;text-align:center}.stats b{display:block;margin-top:5px}.brand-en{font-size:8px}.action-row{gap:6px}.action button{width:72px}.story{padding:18px 20px 22px}.chronicle{padding:20px 22px}}
@media(max-width:600px){body:not(.game):before{inset:10px}body:not(.game):after{inset:16px}.hero{padding:56px 26px}.hero h1{font-size:clamp(42px,15vw,64px)}.discord{width:min(82vw,320px);padding:16px 18px}.game-shell{width:100%;padding:0}.game-header{padding:15px 15px 12px;background:#07100f}.panel{border-left:0;border-right:0}.scene-art{min-height:205px}.scene-head{padding:17px 18px 12px}.action{bottom:0}.chapter{max-width:110px;text-align:right}}
</style></head><body class="${mode}">${content}</body></html>`;}
