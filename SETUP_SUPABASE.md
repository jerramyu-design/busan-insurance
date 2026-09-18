# Supabase 與網站部署

此版本已完成本機測試，但雲端專案、Secrets 及正式網站網址尚待設定。以下指令已用 Supabase CLI 2.117.0 的 --help 核對。正式部署須登入擁有該專案權限的 Supabase 帳戶。

## 1. 建立專案

在使用者指定的 Supabase 組織建立 busan-insurance，建議區域選東京 ap-northeast-1。先確認組織方案與新增專案費用，再建立。記下 PROJECT_REF。不要把資料庫密碼貼入 GitHub。

## 2. 建立資料表（二選一）

最簡單：在新專案 SQL Editor 執行 supabase/schema.sql，然後執行 supabase/verify.sql。預期四張表 RLS=true；anon/authenticated 所有權限=false，後端函式 service_execute=true。

使用 CLI 遷移歷史：

    npx --yes supabase@2.117.0 login
    npx --yes supabase@2.117.0 link --project-ref PROJECT_REF
    npx --yes supabase@2.117.0 db push --dry-run
    npx --yes supabase@2.117.0 db push

不要對不相關的現有資料庫套用。若舊原型已有加密資料，本版本的 HMAC 索引及 AAD 格式不同：先保留原始加密金鑰並另行遷移既有資料；不能只替換金鑰或把舊 key_version 改成1。此移交時連線帳戶沒有 Supabase 專案，未處理任何真實既有旅客資料。

## 3. 設定後端 Secrets

在 Supabase Edge Functions → Secrets 設定：

| 名稱 | 用途 |
|---|---|
| COMPANY_ACCESS_CODE | 本次對話指定的公司登入密碼 |
| STATS_PASSWORD | 本次對話指定的獨立統計密碼 |
| DATA_ENCRYPTION_KEY | 隨機32 bytes 的 Base64，AES-256-GCM 加密 |
| INDEX_HASH_KEY | 另一組獨立隨機32 bytes 的 Base64，HMAC-SHA-256 索引 |
| ALLOWED_ORIGINS | 正式網站 origin，可用逗號分隔；不得為星號 |

Supabase 自動提供 SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY；不要加入前端。

本機產生金鑰（不輸出到畫面，也不覆蓋既有檔案）：

    npm run secrets:init

它會建立被 Git 忽略的 .env.local。用本機編輯器填入兩個既定密碼及 ALLOWED_ORIGINS。例如 GitHub Pages 網站的 origin 是 https://jerramyu-design.github.io，不含 /busan-insurance/ 路徑。

設定完成後上傳 Secrets：

    npx --yes supabase@2.117.0 secrets set --project-ref PROJECT_REF --env-file .env.local

請另外安全備份兩組金鑰。GitHub、公開網頁及交付 ZIP 都不能包含 .env.local。不要使用 .env.example 儲存真實值。

## 4. 部署 Edge Function

在專案根目錄執行：

    npx --yes supabase@2.117.0 functions deploy insurance-api --project-ref PROJECT_REF --no-verify-jwt --use-api

本程式在 handler.mjs 自行驗證公司密碼、可撤銷登入憑證與獨立統計密碼，因此平台 verify_jwt=false 是刻意設定；它不是匿名讀寫資料庫。部署時須一併包含 domain.mjs、crypto.mjs、db.mjs、handler.mjs 及 deno.json。

API網址：

    https://PROJECT_REF.supabase.co/functions/v1/insurance-api

## 5. 建立靜態網站

PowerShell：

    $env:BUSAN_API_URL='https://PROJECT_REF.supabase.co/functions/v1/insurance-api'
    npm ci
    npm test
    npm run build -- --production

或者修改 config.js 的 apiUrl 為上述公開 Function URL，再執行正式建置。config.js 不需要任何高權限金鑰。正式建置會拒絕未設定 API 的狀態。

將 dist/ 內容放到 HTTPS 靜態主機，並把該網站 origin 加入 ALLOWED_ORIGINS。只發布 dist/；不得直接發布專案根目錄。若主機不支援 _headers，可在主機設定同等的 Cache-Control: no-store、X-Content-Type-Options: nosniff、Referrer-Policy: no-referrer、X-Frame-Options: DENY 標頭。頁面本身已包含 CSP。

## 6. 正式驗收

- 在雲端執行 supabase/verify.sql 並檢查 Supabase Security Advisor。
- 使用正確與錯誤公司密碼測試。
- 以兩個裝置測試不同旅客集中於同一統計表。
- 同一身分證再次送出，只留下更新後的一筆。
- 測試 2011-10-19（Y1）及 2011-10-18（成人方案）生日邊界。
- 錯誤統計密碼不可取得資料，正確密碼顯示統計。
- 確認原始圖片與不便險完整內容皆能開啟。
- 僅在測試資料上測試清除確認；不可拿真實旅客資料做破壞性測試。

本機已驗證同樣規則與資料庫權限，仍需實際 Supabase 專案才能驗證平台環境、Secrets、CORS 及多裝置網路連線。

## 官方依據

- [Edge Function 自訂驗證](https://supabase.com/docs/guides/functions/auth)
- [Edge Function Secrets](https://supabase.com/docs/guides/functions/secrets)
- [資料庫 RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [CLI 文件](https://supabase.com/docs/reference/cli/introduction)
