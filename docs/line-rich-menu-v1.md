# LINE 圖文選單（V1 · LIFF）

上排：上傳照片｜出勤打卡｜紀錄地點  
下排：記帳｜待辦事項｜開啟網站

**行為**
- **紀錄地點** → 開定位頁 → 自動定位  
- **出勤打卡** → 開打卡頁  
- **記帳** → 開一頁式記帳（支出／收款一次填完送出）  
- 仍用 LIFF（可關閉回聊天室）  
- **不主動推播**（DEC-007）  
- **上傳照片／待辦** 暫留聊天室（多圖／列表較適合）

---

## 建議：一頁一個 LIFF（避免跳兩次）

在 **LINE Login** 頻道新增：

| LIFF | Endpoint URL | 圖文選單 URI |
|---|---|---|
| 出勤 | `https://plumber-electrician-seven.vercel.app/liff/attendance` | `https://liff.line.me/{出勤ID}` |
| 定位 | `https://plumber-electrician-seven.vercel.app/liff/location` | `https://liff.line.me/{定位ID}` |
| 記帳 | `https://plumber-electrician-seven.vercel.app/liff/expense` | `https://liff.line.me/{記帳ID}` |

Size=Full、Scope=`profile`、Add friend=Off。

### Vercel（Redeploy）
```
VITE_LIFF_ID_ATTENDANCE={出勤ID}
VITE_LIFF_ID_LOCATION={定位ID}
VITE_LIFF_ID_EXPENSE={記帳ID}
```

### （可選）Supabase Edge secrets
```
LIFF_ID_ATTENDANCE=…
LIFF_ID_LOCATION=…
LIFF_ID_EXPENSE=…
APP_BASE_URL=https://plumber-electrician-seven.vercel.app
```

### 其餘選單
| 按鈕 | 類型 | 內容 |
|---|---|---|
| 開啟網站 | 連結 | `https://plumber-electrician-seven.vercel.app/` |
| 上傳照片 | 文字 | `上傳照片` |
| 待辦事項 | 文字 | `待辦事項` |

聊天室傳「記帳」也會回短卡片開 `/liff/expense`。

---

## 備援：共用一個 LIFF
Endpoint：`https://plumber-electrician-seven.vercel.app/liff`  
選單：`…/{ID}/attendance`、`…/location`、`…/expense`  
Vercel：`VITE_LIFF_ID={ID}`
