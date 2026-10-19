import nodemailer from 'nodemailer';

// 初始化郵件傳輸器
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

/**
 * 發送忘記密碼重置郵件
 */
export async function sendPasswordResetEmail(
  recipientEmail: string,
  resetToken: string,
  studentName: string
): Promise<boolean> {
  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: recipientEmail,
    subject: 'UniPass 密碼重置請求',
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">UniPass</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">密碼重置請求</p>
        </div>
        
        <div style="background: #f9fafb; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <p style="color: #333; font-size: 16px; margin: 0 0 20px 0;">
            親愛的 ${studentName}，
          </p>
          
          <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 30px 0;">
            我們收到了您的密碼重置請求。請點擊下方按鈕來重設您的密碼。此鏈接將在 <strong>24 小時</strong>內有效。
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px;">
              重設密碼
            </a>
          </div>
          
          <p style="color: #999; font-size: 13px; margin: 30px 0 0 0; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            或複製此鏈接到瀏覽器：<br>
            <code style="background: #f3f4f6; padding: 8px; border-radius: 4px; word-break: break-all; color: #667eea;">${resetLink}</code>
          </p>
          
          <p style="color: #999; font-size: 13px; margin: 20px 0 0 0;">
            <strong>安全提示：</strong>如果您沒有要求重設密碼，請忽略此郵件。您的帳戶仍然是安全的。
          </p>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
          <p>© 2026 UniPass System. All rights reserved.</p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ 重置密碼郵件已發送至: ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error(`❌ 郵件發送失敗 (${recipientEmail}):`, error);
    return false;
  }
}

/**
 * 驗證郵件傳輸器連線
 */
export async function verifyTransporter(): Promise<boolean> {
  try {
    await transporter.verify();
    console.log('✅ 郵件傳輸器已連線');
    return true;
  } catch (error) {
    console.error('❌ 郵件傳輸器連線失敗:', error);
    return false;
  }
}
