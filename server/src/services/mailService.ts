import nodemailer, { SendMailOptions } from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';

type MailErrorCategory =
  | 'SMTP_AUTH_ERROR'
  | 'SMTP_CONNECTION_ERROR'
  | 'SMTP_TIMEOUT'
  | 'SMTP_PROTOCOL_ERROR'
  | 'SMTP_ENVELOPE_ERROR'
  | 'SMTP_MESSAGE_ERROR'
  | 'SMTP_TLS_ERROR'
  | 'UNKNOWN_MAIL_ERROR';

interface MailSendResult {
  success: boolean;
  messageId?: string;
  errorCategory?: MailErrorCategory;
  errorCode?: string;
  errorMessage?: string;
  diagnostics?: Record<string, unknown>;
}

export interface MailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
}

type SmtpError = Error & {
  code?: string;
  errno?: number;
  command?: string;
  response?: string;
  responseCode?: number;
  rejected?: string[];
};

const SMTP_HOST = 'smtp.gmail.com';
const SMTP_PORT = 465;
const SMTP_SECURE = true;

function getEmailCredentials(): { emailUser: string; emailPass: string } {
  return {
    emailUser: process.env.EMAIL_USER || '',
    emailPass: process.env.EMAIL_PASS || '',
  };
}

function validateEnvironmentVariables(
  emailUser: string,
  emailPass: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!emailUser) {
    errors.push('EMAIL_USER is missing. Set EMAIL_USER in .env');
  }

  if (!emailPass) {
    errors.push('EMAIL_PASS is missing. Set EMAIL_PASS in .env');
  }

  if (emailUser && !emailUser.includes('@')) {
    errors.push(`EMAIL_USER format is invalid: ${emailUser}`);
  }

  if (emailPass && emailPass.length < 10) {
    errors.push(`EMAIL_PASS length looks too short: ${emailPass.length}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function createTransporter(emailUser: string, emailPass: string) {
  const smtpConfig: SMTPTransport.Options = {
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: emailUser,
      pass: emailPass,
    },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  };

  return nodemailer.createTransport(smtpConfig);
}

function classifyMailError(error: SmtpError): MailErrorCategory {
  const code = String(error.code || '').toUpperCase();
  const msg = String(error.message || '').toLowerCase();

  if (code === 'EAUTH' || msg.includes('invalid login') || msg.includes('authentication')) {
    return 'SMTP_AUTH_ERROR';
  }

  if (code === 'ETIMEDOUT' || code === 'ESOCKET' || msg.includes('timeout')) {
    return 'SMTP_TIMEOUT';
  }

  if (
    code === 'ECONNECTION' ||
    code === 'ECONNREFUSED' ||
    code === 'EHOSTUNREACH' ||
    msg.includes('connection')
  ) {
    return 'SMTP_CONNECTION_ERROR';
  }

  if (code === 'EPROTOCOL') {
    return 'SMTP_PROTOCOL_ERROR';
  }

  if (code === 'EENVELOPE' || msg.includes('envelope')) {
    return 'SMTP_ENVELOPE_ERROR';
  }

  if (code === 'EMESSAGE' || msg.includes('message')) {
    return 'SMTP_MESSAGE_ERROR';
  }

  if (msg.includes('certificate') || msg.includes('tls') || msg.includes('ssl')) {
    return 'SMTP_TLS_ERROR';
  }

  return 'UNKNOWN_MAIL_ERROR';
}

export async function verifyMailConnection(): Promise<boolean> {
  const { emailUser, emailPass } = getEmailCredentials();

  console.log('[MailService] SMTP verify start', {
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    user: emailUser || 'MISSING',
  });

  const validation = validateEnvironmentVariables(emailUser, emailPass);
  if (!validation.valid) {
    console.error('[MailService] Environment validation failed', validation.errors);
    return false;
  }

  try {
    const transporter = createTransporter(emailUser, emailPass);
    await transporter.verify();
    console.log('[MailService] SMTP verification succeeded');
    return true;
  } catch (err) {
    const error = err as SmtpError;
    const errorCategory = classifyMailError(error);

    console.error('[MailService] SMTP verification failed', {
      category: errorCategory,
      code: error.code || 'N/A',
      command: error.command || 'N/A',
      response: error.response || 'N/A',
      responseCode: error.responseCode || 'N/A',
      message: error.message,
      stack: error.stack,
    });
    return false;
  }
}

export async function sendMail(payload: MailPayload): Promise<MailSendResult> {
  const { emailUser, emailPass } = getEmailCredentials();
  const validation = validateEnvironmentVariables(emailUser, emailPass);

  if (!validation.valid) {
    return {
      success: false,
      errorCategory: 'UNKNOWN_MAIL_ERROR',
      errorCode: 'ENV_ERROR',
      errorMessage: validation.errors.join('; '),
      diagnostics: {
        envErrors: validation.errors,
      },
    };
  }

  try {
    const transporter = createTransporter(emailUser, emailPass);

    const mailOptions: SendMailOptions = {
      from: emailUser,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      cc: payload.cc,
      bcc: payload.bcc,
      replyTo: payload.replyTo,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[MailService] Email sent', {
      to: payload.to,
      subject: payload.subject,
      messageId: info.messageId,
      response: info.response,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (err) {
    const error = err as SmtpError;
    const errorCategory = classifyMailError(error);

    console.error('[MailService] Email send failed', {
      category: errorCategory,
      code: error.code || 'N/A',
      command: error.command || 'N/A',
      response: error.response || 'N/A',
      responseCode: error.responseCode || 'N/A',
      message: error.message,
      stack: error.stack,
      to: payload.to,
      subject: payload.subject,
    });

    return {
      success: false,
      errorCategory,
      errorCode: error.code,
      errorMessage: error.message,
      diagnostics: {
        command: error.command,
        response: error.response,
        responseCode: error.responseCode,
        rejected: error.rejected,
        errno: error.errno,
      },
    };
  }
}

export async function sendResetLink(
  recipientEmail: string,
  resetToken: string,
  studentName: string,
  frontendUrl?: string
): Promise<MailSendResult> {
  const baseUrl = frontendUrl || process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>UniPass Password Reset</h2>
      <p>Hi ${studentName},</p>
      <p>Please click the link below to reset your password (valid for 24 hours):</p>
      <p><a href="${resetLink}">${resetLink}</a></p>
      <p>If you did not request this, please ignore this email.</p>
    </div>
  `;

  const textContent = `
UniPass Password Reset

Hi ${studentName},

Please use this link to reset your password (valid for 24 hours):
${resetLink}

If you did not request this, please ignore this email.
  `;

  return sendMail({
    to: recipientEmail,
    subject: 'UniPass 密碼重置請求',
    html: htmlContent,
    text: textContent,
  });
}

export async function sendResetCode(
  recipientEmail: string,
  resetCode: string,
  studentName: string,
  expiresInMinutes: number
): Promise<MailSendResult> {
  const safeName = studentName.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character);
  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>UniPass 密碼重設驗證</h2>
      <p>您好，${safeName}：</p>
      <p>請輸入以下驗證碼設定新密碼。驗證碼將於 ${expiresInMinutes} 分鐘後失效。</p>
      <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px;">${resetCode}</p>
      <p>若您沒有提出重設密碼要求，請忽略此郵件。</p>
    </div>
  `;
  const text = `UniPass 密碼重設驗證\n\n您好，${studentName}：\n\n您的驗證碼是 ${resetCode}，${expiresInMinutes} 分鐘內有效。\n若您沒有提出要求，請忽略此郵件。`;

  return sendMail({
    to: recipientEmail,
    subject: 'UniPass 密碼重設驗證碼',
    html,
    text,
  });
}
