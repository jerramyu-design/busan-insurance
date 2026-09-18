# 韓國釜山自由行保險登記

沿用提供的 Codex-ready 網站與 11 張保險原圖，補齊共用資料庫、安全驗證與部署檔案。固定旅程日：2026-10-18。

網站：https://jerramyu-design.github.io/busan-insurance/

Supabase 專案 busan-insurance（東京，rntcattexcpsjtmmdlzy）已建立，資料表、Edge Function 與 Secrets 均已完成。網站可登入登記；20項本機測試、15項正式API測試及正式網站瀏覽器流程驗收通過，測試登記已清除。完整驗證範圍見 [VERIFICATION.md](VERIFICATION.md)。

## 已完成

- 未滿15歲只可選 Y1；生日剛滿15歲可選 U3／Z10／Z9，前後端皆驗證。
- 保留所有原始保費、保障文字及圖片；SHA-256 原圖比對測試防止誤改。
- 原版畫面、不便險完整原圖與各方案放大查看；手機表格可左右捲動。
- 後端公司密碼驗證，1小時有效且可撤銷的登入憑證；前端只存在記憶體。
- 統計表獨立密碼；關閉、背景切換及5分鐘後清除統計畫面。登出清除旅客欄位。
- AES-256-GCM 加密姓名、身分證、生日及方案；HMAC-SHA-256 身分證索引與原子 upsert。
- 資料表 RLS，撤銷 PUBLIC／anon／authenticated 存取；只允許後端 service_role。
- PostgreSQL 共用的原子頻率限制、禁止任意來源的 CORS、no-store 回應。
- 完整統計快照避免預設1,000筆截斷；清除需再次密碼、60秒一次性確認，資料更新即使確認失效。
- 靜態部署只輸出 dist/ 白名單檔案，排除後端、測試、密碼與金鑰。

## 本機驗證

需要 Node.js 22 以上。

    npm ci
    npm test
    npm run preview

一般預覽使用 config.js 的正式 API。後端只允許正式網站 origin；本機測試請使用以下獨立測試預覽，避免寫入正式資料。

獨立測試預覽（只在127.0.0.1，記憶體 PostgreSQL，不接正式資料）：

    npm run test:preview

測試帳密只供該測試伺服器：公司 test-company-only；統計 test-stats-only。
這些不是正式密碼，不會被放入 dist/。

## 正式部署

依 [SETUP_SUPABASE.md](SETUP_SUPABASE.md) 完成 Supabase、Secrets 與靜態網站。
只發布 dist/，不可把整個 repository 當靜態網站發布。

目前交付狀態及驗證範圍見 [VERIFICATION.md](VERIFICATION.md)。
GitHub Pages 從 gh-pages 分支發布；main 的原始碼更新不會自動更新網站。修改後須重新建置並把 dist/ 內容提交到 gh-pages。Secrets 尚未儲存時，API 會拒絕登入與資料操作。

## 檔案

- index.html／app.js：保留原頁面的前端。
- assets/：11張原始保險圖片。
- supabase/schema.sql：資料表、權限及原子函式。
- supabase/functions/insurance-api/：Edge Function；無外部執行期套件。
- tests/：固定資料、加密、API及實際PostgreSQL整合測試。
- scripts/build.mjs：安全的靜態檔案輸出。
- .env.example：只有設定名稱，不含真實秘密。

## 運作限制

本系統依指定規則登記方案，不會向保險公司自動投保。共用公司密碼持有人可憑同一身分證更新登記，系統不提供逐人身分驗證。保險原圖與方案文字是靜態網站內容；登入保護的是登記及統計資料操作。

登入限制為同一來源每15分鐘12次及全站每分鐘60次；同一辦公室共用網路可能共用額度。統計操作每個登入15分鐘12次，全站每分鐘60次。這些計數保存在資料庫，Edge Function重啟不會歸零；全站限制也防止偽造來源標頭完全繞過限制。

資料庫備份不包含應用層加密金鑰；務必另行安全保管 DATA_ENCRYPTION_KEY 及 INDEX_HASH_KEY。不要直接更換其中任一金鑰，否則既有資料將無法解密或無法依同一身分證更新。
