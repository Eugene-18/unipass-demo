/**
 * 🧪 獨立測試檔案 - 郵件服務診斷工具
 * 
 * 使用方式：
 *   npx tsx src/test-email.ts
 * 或：
 *   npx ts-node src/test-email.ts
 * 
 * 功能：
 *   1. 檢查環境變數設置
 *   2. 驗證 SMTP 連線
 *   3. 發送測試郵件（如果驗證成功）
 */

import dotenv from 'dotenv';
import { verifyMailConnection, sendMail } from './services/mailService.js';

// 載入 .env 檔案
dotenv.config();

// ============================================
// 🔍 測試開始
// ============================================

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║        UniPass 郵件服務 - 完整診斷工具                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // ============================================
  // Step 1: 檢查環境變數
  // ============================================
  console.log('📋 Step 1: 環境變數檢查');
  console.log('─'.repeat(60));

  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (!emailUser) {
    console.error('❌ EMAIL_USER 未設置');
    console.error('   請在 .env 中添加：EMAIL_USER=your_email@gmail.com\n');
    process.exit(1);
  }

  if (!emailPass) {
    console.error('❌ EMAIL_PASS 未設置');
    console.error('   請在 .env 中添加：EMAIL_PASS=your_16_digit_password\n');
    process.exit(1);
  }

  console.log(`✅ EMAIL_USER: ${emailUser}`);
  console.log(`✅ EMAIL_PASS: ${emailPass.substring(0, 4)}${'*'.repeat(Math.max(0, emailPass.length - 4))} (${emailPass.length} 字元)`);
  console.log(`✅ FRONTEND_URL: ${frontendUrl}`);
  console.log();

  // ============================================
  // Step 2: 驗證 SMTP 連線
  // ============================================
  console.log('🔌 Step 2: SMTP 連線驗證');
  console.log('─'.repeat(60));

  const connectionVerified = await verifyMailConnection();
  console.log();

  if (!connectionVerified) {
    console.error('❌ SMTP 連線驗證失敗！');
    console.error('   請檢查上面的診斷信息，並根據排查建議排除問題。\n');
    process.exit(1);
  }

  // ============================================
  // Step 3: 發送測試郵件
  // ============================================
  console.log('📧 Step 3: 發送測試郵件');
  console.log('─'.repeat(60));

  const testEmail = emailUser; // 送給自己測試
  const testSubject = '🧪 UniPass 郵件服務測試 - 成功標記';
  const testHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px;">
        <h1 style="margin: 0;">✅ 郵件服務正常！</h1>
      </div>
      <div style="background: #f5f5f5; padding: 20px; margin-top: 20px; border-radius: 5px;">
        <p>您好，</p>
        <p>这是一封來自 UniPass 系统的测試郵件。如果您能看到這條訊息，表示所有設定都已正確。</p>
        <p><strong>測試信息：</strong></p>
        <ul>
          <li>發送時間: ${new Date().toLocaleString('zh-TW')}</li>
          <li>收件箱: ${testEmail}</li>
          <li>服務器: smtp.gmail.com:465</li>
          <li>連線類型: SSL/TLS</li>
        </ul>
        <p style="color: #999; font-size: 12px;">
          — UniPass System Test Suite
        </p>
      </div>
    </div>
  `;

  const testText = `
UniPass 郵件服務測試

您好，

這是一封來自 UniPass 系統的測試郵件。如果您能看到這條訊息，表示所有設定都已正確。

測試信息：
• 發送時間: ${new Date().toLocaleString('zh-TW')}
• 收件箱: ${testEmail}
• 服務器: smtp.gmail.com:465
• 連線類型: SSL/TLS

— UniPass System Test Suite
  `;

  const result = await sendMail({
    to: testEmail,
    subject: testSubject,
    html: testHtml,
    text: testText,
  });

  console.log();

  if (result.success) {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                    🎉 測試成功！                           ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('✅ 郵件已成功發送！');
    console.log(`   Message ID: ${result.messageId}`);
    console.log(`   收件箱: ${testEmail}`);
    console.log('\n📧 請檢查你的信箱確認收到测試郵件。\n');

    console.log('👍 系統狀態：');
    console.log('   • 環境變數: ✅');
    console.log('   • SMTP 連線: ✅');
    console.log('   • 郵件發送: ✅');
    console.log('\n現在你可以正常使用忘記密碼功能了！\n');
  } else {
    console.log('❌ 郵件發送失敗\n');
    console.log('📋 錯誤信息:');
    console.log(`   錯誤分類: ${result.errorCategory}`);
    console.log(`   錯誤代碼: ${result.errorCode}`);
    console.log(`   錯誤訊息: ${result.errorMessage}`);

    if (result.diagnostics) {
      console.log('\n🔍 診斷詳情:');
      Object.entries(result.diagnostics).forEach(([key, value]) => {
        console.log(`   ${key}: ${JSON.stringify(value)}`);
      });
    }

    console.log('\n💡 排查步驟：');
    console.log('   1. 檢查上面的錯誤分類和代碼');
    console.log('   2. 根據排查建議檢查設定');
    console.log('   3. 確認 Gmail 帳號詳細信息是否正確');
    console.log('   4. 嘗試重新啟動後端服務\n');

    process.exit(1);
  }
}

// ============================================
// 🚀 執行測試
// ============================================

main().catch((error) => {
  console.error('💥 發生未預期的錯誤：');
  console.error(error);
  process.exit(1);
});
