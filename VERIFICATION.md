# 驗證紀錄

日期：2026-09-18。

## 通過

- npm test：20項通過、0失敗。測試使用真實 PostgreSQL 引擎 PGlite 執行 schema、權限及交易，再透過實際 HTTP handler 串接資料庫適配層。
- Deno check：Edge Function index.ts 通過。
- 11張保險原圖 SHA-256 與 Codex-ready 壓縮包完全一致。
- 四張原始方案價目表的文字完全一致。
- 年齡基準、15歲生日邊界、非法日期、所有固定保費及名稱驗證。
- 錯誤登入、無登入、到期、登出撤銷、獨立統計密碼。
- 同身分證原子更新及12筆並行請求只產生一筆紀錄。
- AES-GCM 密文、隨機IV、資料列綁定驗證、HMAC索引。
- anon/authenticated 無資料表或後端函式存取權、四張表啟用RLS。
- 持久限速、一次性及到期清除確認、更新後確認失效。
- 超過1,000筆（1,105筆）統計快照完整回傳。
- 靜態 dist/ 不含後端、金鑰或瀏覽器持久個資儲存。

## 瀏覽器實測

在隔離的本機記憶體 PostgreSQL 測試環境：
- 公司登入成功。
- 2011-10-19 只顯示Y1，送出176元成功。
- 改為2011-10-18可選成人方案，同身分證更新為Z9後統計仍為1人、1,225元。
- 錯誤統計密碼被拒絕；正確測試密碼解鎖。
- 390像素手機檢查無整頁水平溢出；原始不便險圖與Y1放大圖成功載入。
- 登出回到登入頁，清除已填旅客欄位及統計內容。

## 雲端部署

- 使用者指定的 jerramyu@gmail.com's Org 已建立 busan-insurance，專案代碼 rntcattexcpsjtmmdlzy，區域 ap-northeast-1。建立時確認為 Free，每月新增費用 US$0。
- insurance_secure_backend migration 已套用；insurance-api Edge Function 版本1為 ACTIVE。
- 雲端四張表全部 RLS=true，anon/authenticated 無讀寫權限，service_role 有後端存取權。
- 雲端八個函式全部 SECURITY INVOKER，anon/authenticated 不可執行，僅 service_role 可執行。
- Security Advisor：0 ERROR、0 WARN，4 INFO。四項 [rls_enabled_no_policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) 對應四張僅後端存取的資料表，刻意不建立瀏覽器存取政策。
- GitHub main 已匯入，保留原有 Initial commit；原始程式匯入提交 dcf8810。
- 靜態成品已發布 gh-pages 分支（a00929f）；[發布工作](https://github.com/jerramyu-design/busan-insurance/actions/runs/35329269364) 成功。
- [正式網站](https://jerramyu-design.github.io/busan-insurance/) 已可開啟，瀏覽器確認登入頁載入，config.js 已指向正式 API。
- 正式網站四個程式檔回應200，11張已發布圖片的 SHA-256 與原圖全部相同；Git追蹤檔案與已發布前端均未包含本機設定的密碼或加密金鑰。

## 尚待完成

後端的五個自訂 Secrets 已準備於被 Git 忽略的本機 .env.local，待管理者親自貼上並儲存。API 目前回傳503「線上資料庫尚未完成設定」，不開放登入或登記。尚未執行正式環境的登入、加密寫入、多裝置更新與統計解鎖驗收，不把網站頁面可開啟視為完整上線。

## 測試範圍限制

PGlite 使用單一資料庫連線，並行呼叫由其交易佇列執行；本機測試驗證原子 upsert 與唯一鍵，並未模擬多台 Supabase Edge Function 的真實網路競爭。雲端 Security Advisor 及權限查核已通過，正式API及多裝置流程仍待 Secrets 設定。加密金鑰及索引格式改版需另行資料遷移。

GitHub Pages 不套用 _headers 檔；頁面已設 CSP 與 no-referrer，個資 API 由 Edge Function 回傳 no-store。靜態頁面不包含旅客資料或秘密。
