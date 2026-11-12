# LINE 圖文選單（V1 · LIFF）

上排：上傳照片｜出勤打卡｜紀錄地點  
下排：記帳｜待辦事項｜開啟網站

| 按鈕 | LINE 動作建議 | 行為 |
|---|---|---|
| 上傳照片 | 傳文字 `上傳照片` | 聊天室現流（選工地→類型→傳圖） |
| 出勤打卡 | **URI** `{APP}/liff/attendance`（備援文字 `出勤打卡`） | 開啟 LIFF 出勤頁：一鍵上下班、指定工地 |
| 紀錄地點 | **URI** `{APP}/liff/location`（備援文字 `紀錄地點`） | 開啟 LIFF 定位頁：允許 GPS 即完成 |
| 記帳 | 傳文字 `記帳` | 選支出／收款現流 |
| 待辦事項 | 傳文字 `待辦事項` | 查詢／完成 |
| 開啟網站 | URI `{APP}/` | 開網站主頁（舊文案「進入工地」仍可用） |

`{APP}` 預設為正式站，例如 `https://plumber-electrician-seven.vercel.app`。  
Edge Function 的 `APP_BASE_URL` 需與此一致。

請在 LINE Developers → Messaging API → 圖文選單依上表重建並套用。  
**不主動推播**（DEC-007）。

## 可選：正式 LIFF 頻道
若之後要接官方 LIFF SDK，於 LINE Developers 建立 LIFF App，Endpoint 指到上述路徑，並在 Vercel 設 `VITE_LIFF_ID`。  
目前即使未設 LIFF ID，圖文選單 URI 開網站頁在 LINE 內建瀏覽器即可使用。
