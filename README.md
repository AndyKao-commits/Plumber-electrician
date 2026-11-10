# 工程管家（Plumber-electrician）

水電工程行管理系統：出勤、工地、採購、通知與待辦的第一版基礎。

規劃來源：

- [對話 1](https://chatgpt.com/share/6af27b2e-31d8-83ee-9de3-c8287529caeb)
- [對話 2](https://chatgpt.com/share/6af28019-cfd0-83ec-bf49-738de06277ea)

## 本 PR 已對齊的關鍵決策

- 全員工程操作權限相同；敏感財務／他人薪資／個人打卡明細保密
- 不主動推播 LINE；通知與待辦只在系統內
- 採購：最終應付金額 ≥ 3000 需核准；緊急單次 5000、每日 10000
- 跨日班次允許；Email／密碼為主登入；報價稅務每張選擇
- 首頁＝今日待辦＋功能宮格

詳見 `docs/product-decisions.md`、`src/domain/rules.ts`。

## 本機啟動

```bash
npm install
npm run dev
```

示範帳號：老闆、師傅阿明、師傅阿強。

## 接上 Supabase（可選）

1. 複製 `.env.example` → `.env.local`
2. 執行 `supabase/schema.sql`
3. 重啟 `npm run dev`

## 開發策略

全部主要功能完成並整合測試後，才正式交給團隊使用。目前為可操作的規格落地基礎，不是完整正式上線版。
