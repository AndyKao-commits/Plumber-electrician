# LINE 圖文選單（V1 · LIFF）

上排：上傳照片｜出勤打卡｜紀錄地點  
下排：記帳｜待辦事項｜開啟網站

**行為（與原本相同）**
- 點 **紀錄地點** → 開定位頁 → **自動開始定位**（失敗才按再試）
- 點 **出勤打卡** → 開打卡頁
- 仍用 LIFF（可關閉回聊天室）
- **不主動推播**（DEC-007）

---

## 建議：兩個 LIFF（各開一頁，避免跳兩次）

在 **LINE Login** 頻道（不是 Messaging API）新增 **兩個** LIFF：

| LIFF 名稱例 | Endpoint URL | 圖文選單 URI |
|---|---|---|
| 出勤 | `https://plumber-electrician-seven.vercel.app/liff/attendance` | `https://liff.line.me/{出勤LIFF_ID}` |
| 定位 | `https://plumber-electrician-seven.vercel.app/liff/location` | `https://liff.line.me/{定位LIFF_ID}` |

設定：Size=Full、Scope=`profile`、Add friend=Off。

### Vercel 環境變數（Redeploy）
```
VITE_LIFF_ID_ATTENDANCE={出勤LIFF_ID}
VITE_LIFF_ID_LOCATION={定位LIFF_ID}
```

### （可選）Supabase Edge secrets
```
LIFF_ID_ATTENDANCE={出勤LIFF_ID}
LIFF_ID_LOCATION={定位LIFF_ID}
APP_BASE_URL=https://plumber-electrician-seven.vercel.app
```

### 圖文選單其餘格子
| 按鈕 | 類型 | 內容 |
|---|---|---|
| 開啟網站 | 連結 | `https://plumber-electrician-seven.vercel.app/` |
| 上傳照片 | 文字 | `上傳照片` |
| 記帳 | 文字 | `記帳` |
| 待辦事項 | 文字 | `待辦事項` |

為什麼兩個 LIFF？  
一個 LIFF 再用路徑（`…/location`）會多一次轉址，容易覺得「跳兩次」。Endpoint 直接指到該頁，選單只貼 `liff.line.me/{ID}` 最穩。

---

## 備援：只用一個 LIFF
Endpoint：`https://plumber-electrician-seven.vercel.app/liff`  
選單：`https://liff.line.me/{ID}/attendance`、`…/{ID}/location`  
Vercel：`VITE_LIFF_ID={ID}`
