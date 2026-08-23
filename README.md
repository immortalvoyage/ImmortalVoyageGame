# ImmortalVoyageGame

《不朽之旅》網頁文字 RPG 的 V2 clean rewrite。

## Current scope

目前建立的是零第三方依賴、deterministic、server-authoritative 的最小骨架與第一條生存垂直切片：

出生 → 看見世界 → 找人／互動 → 移動 → 取得水與食物 → 背包 → 消耗 → 工作取得貨幣 → 花費貨幣 → 繼續生存。

starter 地點、NPC 名稱與數值只屬可替換的開發 Content Pack，不視為正式世界觀。

## Architecture

- `src/core/`：World Clock、World State、Action Resolver、Game Module Manifest/Wiring、Permission Boundary。
- `src/modules/`：玩法模組；只能透過 server-side Action Resolver 形成正式世界變更。
- `src/content/`：版本化開發內容；後續可替換為正式 Content Pack。
- `src/adapters/`：可替換 I/O；目前只有測試／本機開發用 Memory Store。
- `public/`：純 Browser UI，不載入 Core，不持有世界真相。
- `dev/`：本機 Node authoritative server，僅供開發，不是 production hosting。
- `tests/`：Node 內建 test runner，無第三方 test dependency。

World Clock 採 logical time + timestamp + lazy elapsed resolution；沒有 heartbeat、polling 或背景 worker。

## Local development

需要 Node.js 22+：

```bash
npm test
npm run dev
```

開啟 `http://127.0.0.1:8787` 即可操作目前的最小垂直切片。Memory Store 會在程序重啟後清空，這是刻意的本機開發限制。

## Cost boundary

目前沒有 production database、AI、scheduler、queue、analytics、CDN 或付費 SaaS 依賴，也沒有任何 production 部署變更。
