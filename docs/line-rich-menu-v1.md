# LINE 圖文選單（V1 · LIFF）

上排：上傳照片｜出勤打卡｜紀錄地點  
下排：記帳｜待辦事項｜開啟網站

## 正式 LIFF（可「關閉回聊天室」）

### 1. 建 LIFF（在 **LINE Login** 頻道，不是 Messaging API）
1. LINE Developers → 同一 Provider 的 **LINE Login** → **LIFF** → Add  
2. 設定：
   - Size：Full  
   - **Endpoint URL（重要）**：`https://plumber-electrician-seven.vercel.app/liff`  
     - 不要設成網站首頁 `/`  
     - 不要設成只有 `/liff/attendance`（否則定位會打不開）  
   - Scope：勾 `profile`  
   - Add friend：Off  
3. 複製 **LIFF ID**

### 2. 環境變數
- Vercel：`VITE_LIFF_ID` = LIFF ID → Redeploy  
- （可選）Supabase Edge secret：`LIFF_ID` = 同值（讓 bot 回覆按鈕也走 liff.line.me）  
- （可選）`APP_BASE_URL` = `https://plumber-electrician-seven.vercel.app`

### 3. 圖文選單 URI（Messaging API／官方帳號那邊設定）

把 `{LIFF_ID}` 換成實際 ID：

| 按鈕 | 類型 | URI |
|---|---|---|
| 出勤打卡 | 連結 | `https://liff.line.me/{LIFF_ID}/attendance` |
| 紀錄地點 | 連結 | `https://liff.line.me/{LIFF_ID}/location` |
| 開啟網站 | 連結 | `https://plumber-electrician-seven.vercel.app/` |
| 上傳照片 | 文字 | `上傳照片` |
| 記帳 | 文字 | `記帳` |
| 待辦事項 | 文字 | `待辦事項` |

**路徑對照**（Endpoint = `…/liff` 時）：

- `…/attendance` → 網站 `/liff/attendance`  
- `…/location` → 網站 `/liff/location`  
- 只開 `https://liff.line.me/{LIFF_ID}` → 網站 `/liff` 選單頁（可手動點出勤／定位）

### 4. 常見打不開「紀錄地點」
- 選單那格還是「傳文字」→ 改成 **連結（URI）**，且網址要含 **`/location`**（不是 `/attendance`）  
- Endpoint 設成出勤頁 → 改成 `…/liff`  
- 舊選單沒套用 → 儲存後設為預設選單  

**不主動推播**（DEC-007）。

## 尚未設 LIFF ID 時（暫用）

| 按鈕 | URI / 文字 |
|---|---|
| 出勤打卡 | `https://plumber-electrician-seven.vercel.app/liff/attendance` |
| 紀錄地點 | `https://plumber-electrician-seven.vercel.app/liff/location` |

聊天室傳「出勤打卡／紀錄地點」也會回短卡片開頁。
