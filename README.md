# ImmortalVoyageGame

《不朽之旅》網頁文字 RPG 的 V2 clean rewrite。

## Current scope

目前建立的是零第三方依賴、deterministic、server-authoritative 的最小骨架與第一條生存垂直切片：

出生 → 看見世界 → 找人／互動 → 移動 → 取得水與食物 → 背包 → 消耗 → 工作取得貨幣 → 花費貨幣 → 繼續生存。

在此閉環之上，已加入最小 Purpose Action、Content Pack 驗證、Crafting，以及「由行為形成身分」的 Career 切片。角色不在出生時選固定職業；工作等 authoritative 行為累積後，由 Content Pack 規則推導公開身分。

starter 地點、NPC 名稱、職業身分、配方與數值都只屬可替換的開發 Content Pack，不視為正式世界觀。

## Architecture

- `src/core/`：World Clock、World State、Action Resolver、Schema Migration、Game Module Manifest/Wiring、Permission Boundary。Core 不 import 任何特定 Content Pack。
- `src/game.js`：server-side composition boundary；驗證選定 Content Pack，並透過 runtime context 注入玩法模組。
- `src/modules/`：玩法模組；只能透過 server-side Action Resolver 形成正式世界變更。Gameplay Module 不直接 import `devStarterPack`；Narrative 提供零 AI deterministic fallback，Purpose 由 server 解析尋人意圖，Crafting 與 Career 均可獨立關閉。
- `src/content/`：版本化開發內容與 fail-closed validator；後續可由同一 wiring boundary 換成其他已驗證 Content Pack，不需修改玩法模組。
- `src/adapters/`：可替換 I/O；Memory Store 用於測試，File Store 用於本機持久化開發。
- `public/`：純 Browser UI，不載入 Core，不持有世界真相，也不取得 raw behavior counters。
- `dev/`：本機 Node authoritative server，僅供開發，不是 production hosting。
- `tests/`：Node 內建 test runner，無第三方 test dependency。

World Clock 採 logical time + timestamp + lazy elapsed resolution；沒有 heartbeat、polling 或背景 worker。

## Local development

需要 Node.js 22+：

```bash
npm run verify
npm run dev
```

`npm run verify` 會先對 `src/`、`dev/`、`public/`、`tests/`、`scripts/` 的 JavaScript/MJS 執行 `node --check`，再執行完整 `node --test`。不需要額外套件或外部服務。

開啟 `http://127.0.0.1:8787` 即可操作目前版本。本機世界存檔寫入 `.data/world.json`，以臨時檔 + rename 原子替換；`.data/` 不提交 Git。

## Cost boundary

目前沒有 production database、AI、scheduler、queue、analytics、CDN 或付費 SaaS 依賴，也沒有任何 production 部署變更。
