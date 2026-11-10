# 工程管家（Plumber-electrician）

水電工程行管理系統：出勤打卡、工地紀錄、採購與薪資規劃中的第一版基礎。

規劃來源：[ChatGPT 對話](https://chatgpt.com/share/6af27b2e-31d8-83ee-9de3-c8287529caeb)

## 已完成（本 PR）

- 產品決策整理：`docs/product-decisions.md`、`src/domain/rules.ts`
- Vite + React + TypeScript + TanStack Query + PWA
- `useUser` / `useSites` / `useAttendance` React Query hooks
- 本機示範模式（無 Supabase 也可登入、打卡、工地 CRUD）
- Supabase schema 草案：`supabase/schema.sql`

## 本機啟動

```bash
npm install
npm run dev
```

開啟後可用「老闆」或「師傅阿明」示範帳號登入。

## 接上 Supabase（可選）

1. 複製 `.env.example` 為 `.env.local`，填入 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`
2. 在 Supabase SQL editor 執行 `supabase/schema.sql`
3. 重新啟動 `npm run dev`

## 技術方向

- 前端：手機優先 PWA（離線為第一版必要能力）
- 後端：Supabase（帳號、資料、權限）
- 部署：Cloudflare（商用免費額度優先）
- LINE 官方帳號：後續串接快速打卡／回報按鈕
