# LINE 圖文選單（V1 · LIFF）

上排：上傳照片｜出勤打卡｜紀錄地點  
下排：記帳｜待辦事項｜開啟網站

## 正式 LIFF（建議｜可「關閉回聊天室」）

1. LINE Developers → 同一 **LINE Login** 或 Messaging 頻道 → **LIFF** → **Add**
2. 設定：
   - Size：Full
   - Endpoint URL：`https://plumber-electrician-seven.vercel.app`  
     （網站根網域即可；出勤／定位用路徑區分）
   - Scope：先勾 `profile` 即可（我們仍用網站帳密登入，不作 LINE 登入憑證）
3. 複製 **LIFF ID** → Vercel 環境變數 `VITE_LIFF_ID` → Redeploy
4. 圖文選單兩格改 **URI**（把 `{LIFF_ID}` 換成實際 ID）：

| 按鈕 | URI |
|---|---|
| 出勤打卡 | `https://liff.line.me/{LIFF_ID}/liff/attendance` |
| 紀錄地點 | `https://liff.line.me/{LIFF_ID}/liff/location` |
| 開啟網站 | `https://plumber-electrician-seven.vercel.app/` |

5. 儲存並設為預設選單。手機點進去完成操作後，可按頁面「關閉回聊天室」。

Edge Function 的 `APP_BASE_URL` 請與正式站一致。  
**不主動推播**（DEC-007）。

## 尚未設 LIFF ID 時（暫用）

圖文選單可先用一般網址（無法一鍵關頁，只能左上角返回）：

| 按鈕 | URI / 文字 |
|---|---|
| 出勤打卡 | `https://plumber-electrician-seven.vercel.app/liff/attendance` 或文字 `出勤打卡` |
| 紀錄地點 | `https://plumber-electrician-seven.vercel.app/liff/location` 或文字 `紀錄地點` |
| 上傳照片 | 文字 `上傳照片` |
| 記帳 | 文字 `記帳` |
| 待辦事項 | 文字 `待辦事項` |

Webhook 在收到「出勤打卡／紀錄地點」文字時，也會回短卡片開上述頁面。
