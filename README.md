# UniPass 活動報名與藍新金流修正版

本專案已修正活動報名後的藍新金流流程。使用者在活動詳情按下「我要報名並繳費」後，前端會呼叫後端建立 `payment_pending` 報名紀錄，後端依據活動費用產生藍新 MPG 2.0 的 `TradeInfo` 與 `TradeSha`，前端再建立隱藏表單並自動 POST 到藍新付款頁，不需要使用者另外複製或點擊付款網址。

付款完成後，藍新會 POST 到後端的 `/api/payment/return`；後端驗證 `TradeSha`、解密 `TradeInfo`，將對應報名狀態更新為 `paid`，最後把瀏覽器導向前端的 `/payment/success` 結果頁。`/api/payment/notify` 則提供藍新背景通知使用，正式環境應設定為外網可連線的 HTTPS URL。

## 使用 VSCode 啟動

請使用 VSCode 開啟解壓後的 `event0816_fixed` 資料夾。第一次使用時，開啟兩個終端機分別執行下列指令：

```bash
cd server
npm install
npm run dev
```

```bash
cd client
npm install
npm run dev -- --host 0.0.0.0
```

接著在同一台電腦瀏覽 `http://localhost:5173`。後端預設埠號為 `3000`，前端環境檔 `client/.env` 已設定 `VITE_API_BASE_URL=http://localhost:3000`。

## 本機付款設定

目前 `server/.env` 已放入本次提供的藍新商店設定，並將本機付款完成回傳網址設為：

```text
http://localhost:3000/api/payment/return
```

這只適用於「瀏覽器、前端與後端都在同一台電腦」的測試情境。若藍新後台要求 NotifyURL 必須是公開網址，請啟動 ngrok 或其他反向代理，將下列設定改成公開 HTTPS 網址後重新啟動後端：

```env
NEWEBPAY_NOTIFY_URL=https://你的公開網域/api/payment/notify
NEWEBPAY_RETURN_URL=https://你的公開網域/api/payment/return
FRONTEND_URL=https://你的前端公開網域
```

不要把 `server/.env` 上傳到 GitHub 或公開網路；其中包含資料庫、郵件與藍新金流機密。若這些金鑰曾經公開分享，建議在相關服務後台重新產生並替換。

## 付款測試流程

登入後進入「校園活動」，開啟一個活動詳情，按下「我要報名並繳費」，確認視窗按下確定後，畫面應自動轉到藍新 MPG 付款頁。付款完成或取消後，藍新會回到前端付款結果頁；付款成功時，報名紀錄會由 `payment_pending` 更新為 `paid`，而活動列表會同步顯示已報名。

若畫面沒有跳到藍新頁面，請先確認後端終端機沒有錯誤、`server/.env` 的資料庫可連線、前端瀏覽器沒有阻擋表單導向，並確認 `http://localhost:3000/api/payment/return` 可以回應 303 導向。

## 建置檢查

本修正版已通過以下檢查：

```bash
cd server && npx tsc --noEmit
cd ../client && npx tsc -b && npm run build
```

## 檔案重點

| 檔案 | 用途 |
|---|---|
| `server/src/index.ts` | 建立藍新交易、AES-256-CBC 加密、TradeSha 驗證、NotifyURL/ReturnURL 回傳處理 |
| `server/.env` | 本機實際環境設定，含資料庫與藍新參數，請勿公開 |
| `server/.env.example` | 不含真實機密的環境變數範本 |
| `client/src/App.tsx` | 報名按鈕、付款表單自動 POST、付款結果頁 |
| `client/.env` | 前端呼叫後端的 API 基底網址 |
