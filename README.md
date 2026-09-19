# 21世紀七期河南店｜韓國釜山自由行保險登記

沿用提供的 Codex-ready 網站與 11 張保險原圖，補齊共用資料庫、安全驗證與部署檔案。固定旅程日：2026-10-18。

網站：https://jerramyu-design.github.io/busan-insurance/

Supabase 專案 busan-insurance（東京，rntcattexcpsjtmmdlzy）已完成部署。2026-09-19依使用者指示取消公司登入密碼，開啟網站即可登記；統計表仍需獨立密碼。22項本機測試、免密碼瀏覽器流程與8項正式API檢查通過，驗證範圍見 [VERIFICATION.md](VERIFICATION.md)。

## 已完成

- 未滿15歲只可選 Y1；生日剛滿15歲可選 U3／Z10／Z9，前後端皆驗證。
- 登記成功後詢問是否輸入下一位；選「是」清空旅客欄位及方案並捲動、聚焦姓名欄，選「否」結束填寫並嘗試關閉分頁。瀏覽器禁止自動關閉時顯示完成頁及手動關閉提示。
- 保留所有原始保費、保障文字及圖片；SHA-256 原圖比對測試防止誤改。
- 原版畫面、不便險完整原圖與各方案放大查看；手機表格可左右捲動。
- 主頁加入韓國國旗、海浪與海鷗圖案，以及廣安大橋、甘川文化村、海東龍宮寺照片；電腦與手機排版皆已檢查。素材來源與授權見 [credits.html](assets/travel/credits.html)。
- 旅客登記免密碼；系統按需自動取得1小時有效的公開作業憑證，用於限速與結束作業，不授予統計查看權限，前端只存在記憶體。
- 統計表獨立密碼；關閉、背景切換及5分鐘後清除統計畫面。結束填寫清除旅客欄位。
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

測試預覽直接開放登記；統計密碼僅供該測試伺服器：test-stats-only。
這些不是正式密碼，不會被放入 dist/。

## 正式部署

依 [SETUP_SUPABASE.md](SETUP_SUPABASE.md) 完成 Supabase、Secrets 與靜態網站。
只發布 dist/，不可把整個 repository 當靜態網站發布。

目前交付狀態及驗證範圍見 [VERIFICATION.md](VERIFICATION.md)。
GitHub Pages 從 gh-pages 分支發布；main 的原始碼更新不會自動更新網站。修改後須重新建置並把 dist/ 內容提交到 gh-pages。Secrets 尚未儲存時，API 會拒絕資料操作。

## 檔案

- index.html／app.js：保留原頁面的前端。
- assets/：11張原始保險圖片；新增旅遊素材及署名頁獨立放在 assets/travel/。
- supabase/schema.sql：資料表、權限及原子函式。
- supabase/functions/insurance-api/：Edge Function；無外部執行期套件。
- tests/：固定資料、加密、API及實際PostgreSQL整合測試。
- scripts/build.mjs：安全的靜態檔案輸出。
- .env.example：只有設定名稱，不含真實秘密。

## 運作限制

本系統依指定規則登記方案，不會向保險公司自動投保。任何開啟網站者可憑同一身分證更新登記，系統不提供逐人身分驗證。保險原圖與方案文字是靜態網站內容；統計資料的查閱與清除由獨立統計密碼保護。

公開作業憑證的取得限制為同一來源每15分鐘12次及全站每分鐘60次；同一辦公室共用網路可能共用額度。統計操作每個來源及每個作業憑證15分鐘12次，全站每分鐘60次，重新取得作業憑證不會重置來源限制。這些計數保存在資料庫，Edge Function重啟不會歸零；全站限制也防止偽造來源標頭完全繞過限制。

資料庫備份不包含應用層加密金鑰；務必另行安全保管 DATA_ENCRYPTION_KEY 及 INDEX_HASH_KEY。不要直接更換其中任一金鑰，否則既有資料將無法解密或無法依同一身分證更新。
