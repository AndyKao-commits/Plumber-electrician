# DOC-09 本機示範對齊進度

官方 DOC-09 仍聲明「不得宣稱可直接實作或通過驗收」。此處僅記錄本機示範／領域規則對齊程度，**不是**正式封版證明。

| 項目 | 狀態 | 本機落點 |
|---|---|---|
| REV-01 報價 XOR 工程／維修 | 示範完成 | `assertQuoteAssociation`、`quotations` 表 XOR check、報價頁 |
| REV-02 每批 RLS | Schema 草案 | 新表同檔啟用 RLS；正式 migration 仍待拆批 |
| REV-03 建立即選稅務 | 示範完成 | `createQuotation` 強制 `taxMode`；發布凍結 |
| REV-04 緊急額度事件 | 示範完成 | `emergency_limit_events` + RESERVE／RELEASE；退款不自動釋放 |
| REV-05 零用金契約 | Schema stub | 帳戶／申請／撥款／流水帳表骨架；UI 未做 |
| REV-06 移動加權平均 | 示範完成 | `inventoryCost` + 庫存頁入庫重算 |
| REV-07 禁止自我核准 | 示範完成 | `approvals.ts`；老闆核准他人 |
| REV-08 測試清冊 | 部分 | Vitest 領域規則測試（非完整 76 條） |
| REV-09 個資政策 | 未決 | 仍待 Owner |
| REV-10 RPO/RTO | 未驗證 | 目標常數存在；無備份演練 |
| REV-11 財務事件 | 未做 | — |
| REV-12 合法業務順序 | 示範支援 | 報價可先於施工（先建報價草稿） |

正式開發／部署／GitHub Issues 建立仍需 Owner 明確授權。
