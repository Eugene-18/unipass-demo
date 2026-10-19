import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import crypto from 'crypto';
import { db } from './db';
import { events, registrations, users, students, applications, passwordResets } from './db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { sendResetCode, verifyMailConnection } from './services/mailService';
import { getDepartmentRecommendations, getActivityRecommendations } from './services/recommendation.service';
import { validatePassword } from './utils/passwordPolicy';

// 引入 Google 驗證套件並初始化 Client ID
import { OAuth2Client } from 'google-auth-library';
const googleClient = new OAuth2Client('530250023370-tjo7gu204m0ai8ok79o8v9qpkd6a8vch.apps.googleusercontent.com');

// 計算經緯度距離 (公尺)
function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; 
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

async function getEventsWithRegistrationCounts() {
  const [allEvents, registrationCounts] = await Promise.all([
    db.select().from(events)
      .where(sql`${events.status} IS DISTINCT FROM 'deleted'`)
      .orderBy(desc(events.id)),
    db.select({
      eventId: registrations.eventId,
      count: sql<number>`count(*)::int`,
    })
      .from(registrations)
      .where(sql`${registrations.status} IS DISTINCT FROM 'payment_pending' AND ${registrations.status} IS DISTINCT FROM 'cancelled'`)
      .groupBy(registrations.eventId),
  ]);
  const countsByEventId = new Map<number, number>();
  registrationCounts.forEach(({ eventId, count }) => {
    if (eventId !== null) countsByEventId.set(eventId, Number(count));
  });

  return allEvents.map(event => ({
    ...event,
    currentReg: countsByEventId.get(event.id) ?? 0,
  }));
}

async function emitEventsWithRegistrationCounts() {
  io.emit('all_events_data', { events: await getEventsWithRegistrationCounts() });
}

app.use(cors()); 
// 解析 JSON body
app.use(express.json());
// 解析藍新 ReturnURL / NotifyURL 送過來的 x-www-form-urlencoded 格式
app.use(express.urlencoded({ extended: true }));

app.post("/api/apply/step1", async (req, res) => {
  try {
    const { name, idNumber, email, phoneCode, phoneNumber, programType, identityType } = req.body;
    const existingStudent = await db.select().from(students).where(eq(students.idNumber, idNumber)).limit(1);
    let studentId;

    if (existingStudent.length === 0) {
      const newStudent = await db.insert(students).values({
        name,
        idNumber,
        email,
        phoneCode,
        phoneNumber
      }).returning({ id: students.id });
      
      studentId = newStudent[0].id;
    } else {
      const updatedStudent = await db.update(students).set({
        name,
        email,
        phoneCode,
        phoneNumber
      }).where(eq(students.idNumber, idNumber)).returning({ id: students.id });
      
      studentId = updatedStudent[0].id;
    }

    const newApp = await db.insert(applications).values({
      studentId: studentId,
      serialNumber: `NTUB-${Date.now()}`,
      programType,
      identityType,
      paymentAmount: 500,
    }).returning({ id: applications.id });

    res.status(200).json({ 
      success: true, 
      applicationId: newApp[0].id 
    });
  } catch (error) {
    console.error("儲存第一步資料失敗:", error);
    res.status(500).json({ success: false, error: "伺服器發生錯誤" });
  }
});

const RESET_EMAIL_COOLDOWN_SECONDS = Number(process.env.RESET_EMAIL_COOLDOWN_SECONDS || '60');
const RESET_CODE_TTL_MINUTES = 10;
const RESET_EMAIL_ALLOWED_DOMAINS = (process.env.RESET_EMAIL_ALLOWED_DOMAINS || '')
  .split(',')
  .map((domain) => domain.trim().toLowerCase())
  .filter(Boolean);

const forgotPasswordLastSentAt = new Map<string, number>();

function isAllowedResetEmailDomain(email: string): boolean {
  if (RESET_EMAIL_ALLOWED_DOMAINS.length === 0) {
    return true;
  }
  const domain = email.split('@')[1]?.trim().toLowerCase();
  return Boolean(domain && RESET_EMAIL_ALLOWED_DOMAINS.includes(domain));
}

function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) return reject(error);
      resolve(`scrypt:${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

function hashResetCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

// ==========================================
// 🔥 全新版 Google 登入/註冊 API
// ==========================================
app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ success: false, error: '未提供 Google 授權碼' });
    }

    // 1. 向 Google 伺服器驗證這張 Token 的真偽
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: '530250023370-tjo7gu204m0ai8ok79o8v9qpkd6a8vch.apps.googleusercontent.com',
    });
    
    // 2. 解碼取得使用者的 Google 個人資料
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ success: false, error: '無法解析 Google 帳號資訊' });
    }

    const email = payload.email.trim().toLowerCase();
    const name = payload.name || 'Google 使用者';

    // 3. 檢查這個信箱是否存在於資料庫中
    let [existingUser] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);

    if (existingUser) {
      // ✅ 帳號存在，更新姓名並登入成功！
  // ⛔️ 註解掉這段罪魁禍首，不要再讓 Google 蓋掉我們的資料庫了！
  /* 
  if (existingUser.name !== name) {
    await db.update(users).set({ name }).where(...);
    existingUser.name = name;
  }
  */
      console.log('[Google Auth] Existing user login', { userId: existingUser.id, email });
      const studentId = existingUser.studentId || email.split('@')[0] || email;
      if (!existingUser.studentId) {
        await db.update(users).set({ studentId }).where(eq(users.id, existingUser.id));
      }
      return res.json({ 
        success: true,
        id: existingUser.id,
        studentId,
        email: existingUser.email, 
        name: existingUser.name,
        role: existingUser.role,
        message: '登入成功'
      });
    } else {
      // ❌ 帳號不存在，自動註冊一筆新資料
      const derivedStudentId = email.split('@')[0] || email;
      const [newUser] = await db
        .insert(users)
        .values({
          name: name,
          email: email,
          studentId: derivedStudentId,
          password: null,
          role: 'student',
        })
        .returning();
      
      console.log('[Google Auth] New user created', { userId: newUser.id, email });
      return res.json({ 
        success: true,
        id: newUser.id,
        studentId: newUser.studentId,
        email: newUser.email, 
        name: newUser.name,
        role: newUser.role,
        message: '首次 Google 登入，已自動建立帳號'
      });
    }
  } catch (error) {
    console.error('Google 登入驗證失敗:', error);
    res.status(401).json({ success: false, error: 'Google 授權驗證失敗' });
  }
});

// 🔥 忘記密碼 - 發送重置郵件
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body as { email?: string };
    const normalizedEmail = String(email || '').trim().toLowerCase(); 
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return res.status(400).json({ success: false, message: '請提供有效的電子郵件地址' });
    }

    if (!isAllowedResetEmailDomain(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: '此電子郵件網域目前不允許重設密碼'
      });
    }

    const now = Date.now();
    const cooldownMs = Math.max(1, RESET_EMAIL_COOLDOWN_SECONDS) * 1000;
    const lastSentAt = forgotPasswordLastSentAt.get(normalizedEmail);

    if (lastSentAt && now - lastSentAt < cooldownMs) {
      const waitSeconds = Math.ceil((cooldownMs - (now - lastSentAt)) / 1000);
      return res.status(429).json({
        success: false,
        message: `請稍後再試，約 ${waitSeconds} 秒後可再次發送`
      });
    }

    let [user] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${normalizedEmail}`);

    if (!user) {
      const localPart = normalizedEmail.split('@')[0] || 'user';
      const autoStudentId = `mail_${localPart}_${Date.now()}`;
      const [newUser] = await db
        .insert(users)
        .values({
          email: normalizedEmail,
          name: `Mail User (${localPart})`, 
          studentId: autoStudentId,
          password: null,
          role: 'student',
        })
        .returning();
      user = newUser;
    }

    const resetCode = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MINUTES * 60 * 1000).toISOString();

    await db.update(passwordResets)
      .set({ isUsed: true })
      .where(and(eq(passwordResets.userId, user.id), eq(passwordResets.isUsed, false)));
    const [resetRecord] = await db.insert(passwordResets).values({
      userId: user.id,
      otpCode: hashResetCode(resetCode),
      expiresAt,
      isUsed: false,
    }).returning({ id: passwordResets.id });

    const emailResult = await sendResetCode(
      user.email,
      resetCode,
      user.name,
      RESET_CODE_TTL_MINUTES
    );

    if (!emailResult.success) {
      await db.update(passwordResets)
        .set({ isUsed: true })
        .where(eq(passwordResets.id, resetRecord.id));
      return res.status(500).json({
        success: false,
        message: '郵件發送失敗，請稍後重試'
      });
    }

    forgotPasswordLastSentAt.set(normalizedEmail, Date.now());
    res.json({
      success: true,
      message: `驗證碼已寄送至 ${user.email}，${RESET_CODE_TTL_MINUTES} 分鐘內有效`
    }); 
  } catch (error) {
    console.error('忘記密碼錯誤:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後重試'
    });
  }
});

app.post('/api/users/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body as {
      email?: string;
      code?: string;
      newPassword?: string;
    };
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedCode = String(code || '').trim();
    const password = String(newPassword || '');

    if (!normalizedEmail.includes('@') || !/^\d{6}$/.test(normalizedCode)) {
      return res.status(400).json({ success: false, message: '請輸入有效的 Email 與 6 位數驗證碼' });
    }
    const [user] = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      studentId: users.studentId,
      birthday: users.birthday,
      phone: users.phone,
    })
      .from(users)
      .where(sql`lower(${users.email}) = ${normalizedEmail}`);
    if (!user) {
      return res.status(400).json({ success: false, message: '驗證碼無效或已過期' });
    }
    const passwordError = validatePassword(password, [
      user.name, user.email, user.studentId, user.birthday, user.phone,
    ]);
    if (passwordError) {
      return res.status(400).json({ success: false, message: passwordError });
    }

    const [resetRecord] = await db.select()
      .from(passwordResets)
      .where(and(eq(passwordResets.userId, user.id), eq(passwordResets.isUsed, false)))
      .orderBy(desc(passwordResets.id))
      .limit(1);

    const expectedCodeHash = resetRecord?.otpCode || '';
    const receivedCodeHash = hashResetCode(normalizedCode);
    const codeMatches = expectedCodeHash.length === receivedCodeHash.length
      && crypto.timingSafeEqual(Buffer.from(expectedCodeHash), Buffer.from(receivedCodeHash));
    const isExpired = !resetRecord?.expiresAt || new Date(resetRecord.expiresAt).getTime() <= Date.now();

    if (!resetRecord || !codeMatches || isExpired) {
      return res.status(400).json({ success: false, message: '驗證碼無效或已過期' });
    }

    const passwordHash = await hashPassword(password);
    await db.update(users).set({
      passwordHash,
      password: null,
      passwordResetToken: null,
      passwordResetTokenExpiry: null,
    }).where(eq(users.id, user.id));
    await db.update(passwordResets)
      .set({ isUsed: true })
      .where(eq(passwordResets.id, resetRecord.id));

    res.json({ success: true, message: '密碼已成功更新，請使用新密碼登入' });
  } catch (error) {
    console.error('重設密碼錯誤:', error);
    res.status(500).json({ success: false, message: '系統錯誤，請稍後重試' });
  }
});

// 🔥 建立 Gmail 測試帳號 (開發用)
app.post('/api/auth/seed-test-user', async (req, res) => {
  try {
    const testEmail = 'chloewu107@gmail.com';
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, testEmail));

    if (existingUser) {
      return res.json({
        success: true,
        message: '測試帳號已存在',
        user: { id: existingUser.id, email: existingUser.email, name: existingUser.name }
      });
    }

    const [newUser] = await db.insert(users).values({
      email: testEmail,
      name: 'Chloe Wu (測試)',
      studentId: 'TEST001',
      password: null, 
    }).returning();

    res.json({
      success: true,
      message: '✅ 測試帳號已建立！現在可以用此 Gmail 測試忘記密碼功能', 
      user: { id: newUser.id, email: newUser.email, name: newUser.name }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '建立測試帳號失敗' });
  }
});

// 🔥 建立指定 Email 測試帳號 (開發用)
app.post('/api/auth/seed-user', async (req, res) => {
  try {
    const { email, name, studentId } = req.body as {
      email?: string;
      name?: string;
      studentId?: string;
    };
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const [existingUser] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${normalizedEmail}`);

    if (existingUser) {
      return res.json({
        success: true,
        message: '測試帳號已存在',
        user: { id: existingUser.id, email: existingUser.email, name: existingUser.name }
      });
    }

    const fallbackStudentId = normalizedEmail.split('@')[0] || `test_${Date.now()}`;
    const [newUser] = await db.insert(users).values({
      email: normalizedEmail, 
      name: String(name || 'Test User').trim() || 'Test User',
      studentId: String(studentId || fallbackStudentId).trim(),
      password: null,
      role: 'student',
    }).returning();

    res.json({ success: true, message: '✅ 測試帳號已建立' });
  } catch (error) {
    res.status(500).json({ success: false, message: '建立測試帳號失敗' });
  }
});

// 🔥 初始化測試資料
app.get('/api/init-test-data', async (req, res) => {
  try {
    const mockEventsData = [
      { title: '114 學年度 資管系專題成果展 (主要演示)', desc: '本系年度盛事，歡迎全校師生蒞臨指導。', date: '2026/02/06 09:00 ~ 17:00' },
      { title: '北商好聲音 - 歌唱大賽', desc: '尋找北商好聲音！冠軍獎金 5,000 元。', date: '2026/03/15 18:00 ~ 21:00' },
      { title: '桃園校區 志工服務隊招募', desc: '招募熱血志工，服務桃園偏鄉小學。', date: '2026/03/20 08:00 ~ 17:00' },
      { title: 'AI 生成式藝術工作坊', desc: '學習使用 Midjourney 與 Stable Diffusion。', date: '2026/04/10 13:00 ~ 16:00' },
      { title: 'ITS - Python 程式設計證照考試', desc: 'ITS Python 國際證照校內考試場次。', date: '2023-05-01' }
    ];

    for (const evt of mockEventsData) {
      await db.insert(events).values({
        title: evt.title,
        description: evt.desc,
        eventDate: evt.date,
        locationLat: 25.0423,
        locationLng: 121.5255,
        currentCheckInCode: '000000', 
        isCheckInActive: true, 
      });
    }
    res.json({ msg: '資料追加成功！5 筆測試活動已加入 PostgreSQL 資料庫。' });
  } catch (error) {
    console.error('Init Error:', error);
    res.status(500).json({ error: '建立失敗', details: String(error) });
  }
});

// ==========================================
// 藍新金流：交易建立、回傳與通知處理
// ==========================================

type NewebPayCallbackBody = {
  Status?: string;
  TradeInfo?: string;
  TradeSha?: string;
  [key: string]: unknown;
};

type NewebPayResult = {
  Status?: string;
  Message?: string;
  Result?: Record<string, unknown>;
  [key: string]: unknown;
};

const NEWEBPAY_VERSION = process.env.NEWEBPAY_VERSION || '2.0';
const NEWEBPAY_GATEWAY = process.env.NEWEBPAY_PAY_GATEWAY || 'https://ccore.newebpay.com/MPG/mpg_gateway';

function getNewebPayConfig() {
  const merchantId = String(process.env.NEWEBPAY_MERCHANT_ID || '').trim();
  const hashKey = String(process.env.NEWEBPAY_HASH_KEY || '').trim();
  const hashIV = String(process.env.NEWEBPAY_HASH_IV || '').trim();

  if (!merchantId || !hashKey || !hashIV) {
    throw new Error('藍新金流環境變數未完整設定：NEWEBPAY_MERCHANT_ID、NEWEBPAY_HASH_KEY、NEWEBPAY_HASH_IV');
  }

  if (Buffer.byteLength(hashKey, 'utf8') !== 32 || Buffer.byteLength(hashIV, 'utf8') !== 16) {
    throw new Error('藍新金流 HashKey 必須為 32 bytes，HashIV 必須為 16 bytes');
  }

  return { merchantId, hashKey, hashIV };
}

function encodePaymentIdentity(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decodePaymentIdentity(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function encryptTradeInfo(params: Record<string, string>, hashKey: string, hashIV: string): string {
  const plainText = new URLSearchParams(params).toString();
  const cipher = crypto.createCipheriv('aes-256-cbc', hashKey, hashIV);
  return cipher.update(plainText, 'utf8', 'hex') + cipher.final('hex');
}

function calculateTradeSha(tradeInfo: string, hashKey: string, hashIV: string): string {
  return crypto
    .createHash('sha256')
    .update(`HashKey=${hashKey}&${tradeInfo}&HashIV=${hashIV}`, 'utf8')
    .digest('hex')
    .toUpperCase();
}

function decryptTradeInfo(tradeInfo: string, hashKey: string, hashIV: string): NewebPayResult {
  const decipher = crypto.createDecipheriv('aes-256-cbc', hashKey, hashIV);
  
  decipher.setAutoPadding(false);
  
  let decrypted = decipher.update(String(tradeInfo), 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  const cleanDecrypted = decrypted.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
  return JSON.parse(cleanDecrypted) as NewebPayResult;
}

function verifyTradeSha(tradeInfo: string, tradeSha: string, hashKey: string, hashIV: string): boolean {
  const expected = calculateTradeSha(tradeInfo, hashKey, hashIV);
  const received = String(tradeSha || '').trim().toUpperCase();
  if (!received || received.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(received, 'utf8'));
}

function getFrontendUrl(): string {
  return String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
}

function buildPaymentReturnUrl(
  status: 'success' | 'failed',
  orderNo: string,
  message: string,
  eventId?: number,
  studentId?: string,
): string {
  const params = new URLSearchParams({
    status,
    orderNo: String(orderNo || ''),
    message: String(message || ''),
  });

  if (eventId && status === 'success') {
    params.set('eventId', String(eventId));
    if (studentId) params.set('studentId', studentId);
    return `${getFrontendUrl()}/payment/success?${params.toString()}`;
  }

  return `${getFrontendUrl()}/?${params.toString()}`;
}

function parsePaymentIdentity(itemDesc: string): { eventId: number; studentId: string } | null {
  const match = String(itemDesc || '').match(/^EVENT:(\d+);USER:([A-Za-z0-9_-]+)$/);
  if (!match) return null;

  try {
    const eventId = Number(match[1]);
    const studentId = decodePaymentIdentity(match[2]);
    if (!Number.isInteger(eventId) || eventId <= 0 || !studentId) return null;
    return { eventId, studentId };
  } catch {
    return null;
  }
}

async function processNewebPayCallback(body: NewebPayCallbackBody) {
  const { hashKey, hashIV } = getNewebPayConfig();
  const tradeInfo = String(body.TradeInfo || '');
  const tradeSha = String(body.TradeSha || '');

  if (!tradeInfo || !verifyTradeSha(tradeInfo, tradeSha, hashKey, hashIV)) {
    throw new Error('藍新回傳 TradeSha 驗證失敗');
  }

  const payResult = decryptTradeInfo(tradeInfo, hashKey, hashIV);
  const result = (payResult.Result || {}) as Record<string, unknown>;
  const merchantOrderNo = String(result.MerchantOrderNo || '');
  const status = String(payResult.Status || body.Status || '').toUpperCase();
  const itemDesc = String(result.ItemDesc || '');
  const identity = parsePaymentIdentity(itemDesc);

  if (status !== 'SUCCESS') {
    return {
      success: false,
      status,
      merchantOrderNo,
      message: String(payResult.Message || '付款未成功'),
    };
  }

  if (!identity) {
    throw new Error('藍新交易成功，但 ItemDesc 缺少有效的活動與使用者資訊');
  }

  const [targetUser] = await db
    .select()
    .from(users)
    .where(eq(users.studentId, identity.studentId));

  if (!targetUser) {
    throw new Error(`找不到付款使用者：${identity.studentId}`);
  }

  const paymentTime = String(result.PayTime || new Date().toISOString());
  const amount = Number(result.Amt || 0);
  const accountLastFive = String(result.Card4No || result.AccountLastFive || '').slice(-5) || null;

  const [existingRegistration] = await db
    .select()
    .from(registrations)
    .where(and(eq(registrations.userId, targetUser.id), eq(registrations.eventId, identity.eventId)));

  if (existingRegistration) {
    await db
      .update(registrations)
      .set({
        status: 'paid',
        amount: Number.isFinite(amount) && amount > 0 ? amount : existingRegistration.amount,
        paymentTime,
        accountLastFive,
      })
      .where(eq(registrations.id, existingRegistration.id));
  } else {
    await db.insert(registrations).values({
      userId: targetUser.id,
      eventId: identity.eventId,
      status: 'paid',
      amount: Number.isFinite(amount) && amount > 0 ? amount : null,
      paymentTime,
      accountLastFive,
      isCheckedIn: false,
      checkInTime: null,
    });
  }

  io.emit('force_refresh_registrations', {
    studentId: identity.studentId,
    eventId: identity.eventId,
  });
  await emitEventsWithRegistrationCounts();

  return {
    success: true,
    status,
    merchantOrderNo,
    message: String(payResult.Message || '付款成功'),
    eventId: identity.eventId,
    studentId: identity.studentId,
  };
}

app.post('/api/create-payment', async (req, res) => {
  try {
    const eventId = Number(req.body?.eventId);
    const studentId = String(req.body?.studentId || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();

    if (!Number.isInteger(eventId) || eventId <= 0 || !studentId) {
      return res.status(400).json({ success: false, message: '缺少有效的活動或使用者資料' });
    }

    const [event] = await db.select().from(events).where(eq(events.id, eventId));
    if (!event) {
      return res.status(404).json({ success: false, message: '找不到此活動' });
    }

    const amount = Number(event.fee ?? 0);
    if (!Number.isInteger(amount) || amount < 0 || amount > 10_000_000) {
      return res.status(400).json({ success: false, message: '報名費金額不正確' });
    }
let [targetUser] = await db.select().from(users).where(eq(users.studentId, studentId));

if (!targetUser) {
  // 🚨 砍掉原本的 insert，改成阻擋並回傳 404
  return res.status(404).json({ 
    success: false, 
    message: '找不到此學生帳號，請先登入系統完成註冊！' 
  });
}

    const [existingRegistration] = await db
      .select()
      .from(registrations)
      .where(and(eq(registrations.userId, targetUser.id), eq(registrations.eventId, eventId)));

    if (existingRegistration?.status === 'paid' || existingRegistration?.status === 'registered' || existingRegistration?.status === 'checked_in') {
      return res.status(409).json({ success: false, message: '您已完成此活動報名或付款' });
    }

    if (amount === 0) {
      if (existingRegistration) {
        await db.update(registrations).set({
          status: 'registered',
          amount: 0,
          paymentTime: null,
          accountLastFive: null,
          isCheckedIn: false,
          checkInTime: null,
        }).where(eq(registrations.id, existingRegistration.id));
      } else {
        await db.insert(registrations).values({
          userId: targetUser.id,
          eventId,
          status: 'registered',
          amount: 0,
          isCheckedIn: false,
          checkInTime: null,
        });
      }

      await emitEventsWithRegistrationCounts();
      return res.json({ success: true, free: true, eventId });
    }

    const { merchantId, hashKey, hashIV } = getNewebPayConfig();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const merchantOrderNo = `EV${timestamp}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`.slice(0, 30);
    const itemDesc = `EVENT:${eventId};USER:${encodePaymentIdentity(studentId)}`;
    const returnUrl = String(process.env.NEWEBPAY_RETURN_URL || `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/payment/return`).trim();
    const notifyUrl = String(process.env.NEWEBPAY_NOTIFY_URL || '').trim();

    const tradeInfo = encryptTradeInfo({
      MerchantID: merchantId,
      RespondType: 'JSON',
      TimeStamp: timestamp,
      Version: NEWEBPAY_VERSION,
      MerchantOrderNo: merchantOrderNo,
      Amt: String(amount),
      ItemDesc: itemDesc,
      Email: email,
      ReturnURL: returnUrl,
      NotifyURL: notifyUrl,
      ClientBackURL: `${getFrontendUrl()}/events`,
      OrderComment: `UniPass 活動 ${eventId} 報名`,
      LangType: 'zh-tw',
      CREDIT: '1',
    }, hashKey, hashIV);
    const tradeSha = calculateTradeSha(tradeInfo, hashKey, hashIV);

    if (existingRegistration) {
      await db.update(registrations).set({
        status: 'payment_pending',
        amount,
        paymentTime: null,
        accountLastFive: null,
      }).where(eq(registrations.id, existingRegistration.id));
    } else {
      await db.insert(registrations).values({
        userId: targetUser.id,
        eventId,
        status: 'payment_pending',
        amount,
        paymentTime: null,
        accountLastFive: null,
        isCheckedIn: false,
        checkInTime: null,
      });
    }

    return res.json({
      success: true,
      data: {
        action: NEWEBPAY_GATEWAY,
        MerchantID: merchantId,
        TradeInfo: tradeInfo,
        TradeSha: tradeSha,
        Version: NEWEBPAY_VERSION,
        MerchantOrderNo: merchantOrderNo,
      },
    });
  } catch (error) {
    console.error('建立藍新付款訂單失敗:', error);
    return res.status(500).json({ success: false, message: (error as Error).message || '建立付款訂單失敗' });
  }
});

app.post('/api/payment/notify', async (req, res) => {
  try {
    const result = await processNewebPayCallback(req.body as NewebPayCallbackBody);
    console.log('[NewebPay Notify]', result);
    return res.status(200).send('1|OK');
  } catch (error) {
    console.error('處理藍新 NotifyURL 失敗:', error);
    return res.status(400).send('0|ERROR');
  }
});

app.post('/api/payment/return', async (req, res) => {
  try {
    if (!req.body.TradeInfo) {
      return res.redirect(`${getFrontendUrl()}/?status=failed&message=MissingTradeInfo`);
    }

    const result = await processNewebPayCallback(req.body as NewebPayCallbackBody);
    const status = result.success ? 'success' : 'failed';
    
    return res.redirect(303, buildPaymentReturnUrl(
      status,
      result.merchantOrderNo,
      result.message,
      result.eventId,
      result.studentId,
    ));
  } catch (error) {
    console.error('處理藍新 ReturnURL 失敗:', error);
    return res.redirect(303, buildPaymentReturnUrl('failed', '', (error as Error).message || '付款回傳處理失敗'));
  }
});

app.get('/api/payment/return', (_req, res) => {
  return res.redirect(303, buildPaymentReturnUrl('failed', '', '請從藍新付款頁完成交易後返回'));
});

// ==========================================
// 活動儀表板數據 API
// ==========================================
app.put('/api/events/:eventId', async (req, res) => {
  if (req.get('X-User-Role') !== 'teacher') {
    return res.status(403).json({ success: false, message: '只有教師可以編輯活動' });
  }

  try {
    const eventId = Number(req.params.eventId);
    const title = String(req.body?.title || '').trim();
    const dateRange = String(req.body?.dateRange || '').trim();
    const registrationStart = String(req.body?.registrationStart || '').trim();
    const registrationEnd = String(req.body?.registrationEnd || '').trim();
    const fee = Number(req.body?.fee);
    const capacity = Number(req.body?.capacity);
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);

    if (!Number.isInteger(eventId) || eventId <= 0) {
      return res.status(400).json({ success: false, message: '活動編號不正確' });
    }
    if (!title || !dateRange || !registrationStart || !registrationEnd || registrationEnd < registrationStart) {
      return res.status(400).json({ success: false, message: '活動名稱、活動時間及有效的報名起迄日為必填' });
    }
    if (![req.body?.organizer, req.body?.target, req.body?.category, req.body?.campus].every(
      value => String(value || '').trim(),
    )) {
      return res.status(400).json({ success: false, message: '請選擇主辦單位、對象、類別及校區' });
    }
    if (!Number.isInteger(fee) || fee < 0 || fee > 10_000_000 || !Number.isInteger(capacity) || capacity < 1) {
      return res.status(400).json({ success: false, message: '報名費或活動名額不正確' });
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ success: false, message: '活動地點座標不正確' });
    }

    const [event] = await db.select().from(events).where(eq(events.id, eventId));
    if (!event || event.status === 'deleted') {
      return res.status(404).json({ success: false, message: '找不到此活動' });
    }

    await db.update(events).set({
      title,
      description: String(req.body?.description || ''),
      eventDate: dateRange,
      registrationStart,
      registrationEnd,
      organizer: String(req.body?.organizer || ''),
      target: String(req.body?.target || ''),
      category: String(req.body?.category || ''),
      campus: String(req.body?.campus || ''),
      contactPerson: String(req.body?.contactPerson || ''),
      contactPhone: String(req.body?.contactPhone || ''),
      contactEmail: String(req.body?.contactEmail || ''),
      locationName: String(req.body?.locationName || '') || null,
      fee,
      capacity,
      locationLat: lat,
      locationLng: lng,
    }).where(eq(events.id, eventId));

    await emitEventsWithRegistrationCounts();
    return res.json({ success: true, message: '活動更新成功' });
  } catch (error) {
    console.error('更新活動失敗:', error);
    return res.status(500).json({ success: false, message: '更新活動失敗，請稍後再試' });
  }
});

app.delete('/api/events/:eventId', async (req, res) => {
  if (req.get('X-User-Role') !== 'teacher') {
    return res.status(403).json({ success: false, message: '只有教師可以刪除活動' });
  }

  try {
    const eventId = Number(req.params.eventId);
    if (!Number.isInteger(eventId) || eventId <= 0) {
      return res.status(400).json({ success: false, message: '活動編號不正確' });
    }

    const [event] = await db.select().from(events).where(eq(events.id, eventId));
    if (!event || event.status === 'deleted') {
      return res.status(404).json({ success: false, message: '找不到此活動' });
    }

    await db.update(events).set({ status: 'deleted' }).where(eq(events.id, eventId));
    await emitEventsWithRegistrationCounts();
    return res.json({ success: true, message: '活動已從首頁移除，原始資料已保留' });
  } catch (error) {
    console.error('刪除活動失敗:', error);
    return res.status(500).json({ success: false, message: '刪除活動失敗，請稍後再試' });
  }
});

app.patch('/api/events/:eventId/check-in-settings', async (req, res) => {
  if (req.get('X-User-Role') !== 'teacher') {
    return res.status(403).json({ success: false, message: '只有教師可以調整簽到設定' });
  }

  try {
    const eventId = Number(req.params.eventId);
    const bluetoothCheckInRequired = req.body?.bluetoothCheckInRequired;
    const bluetoothBeaconName = String(req.body?.bluetoothBeaconName || '').trim();
    const bluetoothServiceUuid = String(req.body?.bluetoothServiceUuid || '').trim();

    if (!Number.isInteger(eventId) || eventId <= 0) {
      return res.status(400).json({ success: false, message: '活動編號不正確' });
    }
    if (typeof bluetoothCheckInRequired !== 'boolean') {
      return res.status(400).json({ success: false, message: '請指定是否啟用藍牙簽到' });
    }
    if (bluetoothCheckInRequired && !bluetoothBeaconName && !bluetoothServiceUuid) {
      return res.status(400).json({ success: false, message: '啟用藍牙簽到時，請設定藍牙設備名稱或 Service UUID' });
    }

    const [event] = await db.select().from(events).where(eq(events.id, eventId));
    if (!event || event.status === 'deleted') {
      return res.status(404).json({ success: false, message: '找不到此活動' });
    }

    await db.update(events).set({
      bluetoothCheckInRequired,
      bluetoothBeaconName: bluetoothBeaconName || null,
      bluetoothServiceUuid: bluetoothServiceUuid || null,
    }).where(eq(events.id, eventId));

    const settings = {
      eventId,
      bluetoothCheckInRequired,
      bluetoothBeaconName: bluetoothBeaconName || null,
      bluetoothServiceUuid: bluetoothServiceUuid || null,
    };
    io.emit('check_in_settings_sync', settings);
    return res.json({ success: true, data: settings });
  } catch (error) {
    console.error('更新活動簽到設定失敗:', error);
    return res.status(500).json({ success: false, message: '更新簽到設定失敗，請稍後再試' });
  }
});

app.get('/api/events/:eventId/registrations', async (req, res) => {
  if (req.get('X-User-Role') !== 'teacher') {
    return res.status(403).json({ success: false, message: '只有教師可以查看報名名單' });
  }

  try {
    const eventId = Number(req.params.eventId);
    if (!Number.isInteger(eventId) || eventId <= 0) {
      return res.status(400).json({ success: false, message: '活動編號不正確' });
    }
    const [event] = await db.select({ id: events.id }).from(events).where(eq(events.id, eventId));
    if (!event) return res.status(404).json({ success: false, message: '找不到此活動' });

    const attendeeRows = await db.select({
      registrationId: registrations.id,
      studentId: users.studentId,
      name: users.name,
      status: registrations.status,
      isCheckedIn: registrations.isCheckedIn,
    })
      .from(registrations)
      .leftJoin(users, eq(registrations.userId, users.id))
      .where(and(
        eq(registrations.eventId, eventId),
        sql`${registrations.status} IS DISTINCT FROM 'payment_pending' AND ${registrations.status} IS DISTINCT FROM 'cancelled'`,
      ))
      .orderBy(registrations.id);

    return res.json({ success: true, data: attendeeRows });
  } catch (error) {
    console.error('載入活動報名名單失敗:', error);
    return res.status(500).json({ success: false, message: '載入報名名單失敗，請稍後再試' });
  }
});

app.patch('/api/events/:eventId/registrations/:registrationId', async (req, res) => {
  if (req.get('X-User-Role') !== 'teacher') {
    return res.status(403).json({ success: false, message: '只有教師可以取消學生報名' });
  }
  if (req.body?.status !== 'cancelled') {
    return res.status(400).json({ success: false, message: '不支援的報名狀態變更' });
  }

  try {
    const eventId = Number(req.params.eventId);
    const registrationId = Number(req.params.registrationId);
    if (!Number.isInteger(eventId) || eventId <= 0 || !Number.isInteger(registrationId) || registrationId <= 0) {
      return res.status(400).json({ success: false, message: '活動或報名編號不正確' });
    }

    const [registration] = await db.select().from(registrations).where(and(
      eq(registrations.id, registrationId),
      eq(registrations.eventId, eventId),
    ));
    if (!registration || registration.status === 'cancelled' || registration.status === 'payment_pending') {
      return res.status(404).json({ success: false, message: '找不到有效的學生報名紀錄' });
    }

    await db.update(registrations).set({
      status: 'cancelled',
      isCheckedIn: false,
    }).where(eq(registrations.id, registrationId));

    await emitEventsWithRegistrationCounts();
    return res.json({ success: true, message: '學生報名已取消；付款資料已保留，未執行退款' });
  } catch (error) {
    console.error('取消學生報名失敗:', error);
    return res.status(500).json({ success: false, message: '取消報名失敗，請稍後再試' });
  }
});

app.get('/api/events/:eventId/dashboard', async (req, res) => {
  try {
    const eventId = Number(req.params.eventId);

    // 1. 取得活動基本資料 (為了拿名額上限)
    const [event] = await db.select().from(events).where(eq(events.id, eventId));
    if (!event) return res.status(404).json({ success: false, error: '找不到活動' });

    // 2. 取得該活動所有的報名紀錄
    const allRegistrations = await db.select().from(registrations).where(eq(registrations.eventId, eventId));

    // 3. 核心數據計算
    const totalCapacity = event.capacity || 50; // 避免未設定名額的狀況
    const activeRegistrations = allRegistrations.filter(
      registration => registration.status !== 'cancelled' && registration.status !== 'payment_pending',
    );
    const totalRegistered = activeRegistrations.length;
    
    // 計算已簽到人數
    const totalCheckedIn = activeRegistrations.filter(r => r.isCheckedIn).length;
    
    // 計算平均滿意度 (過濾出有給評分的紀錄)
    // 注意：這裡先預留計算邏輯，等你後續實作「填寫問卷」功能就能直接生效
    const ratings = activeRegistrations
      .filter(r => (r as any).rating !== null && (r as any).rating !== undefined)
      .map(r => (r as any).rating as number);
      
    const averageRating = ratings.length > 0 
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) 
      : 0;

    // 計算百分比 (四捨五入到小數第一位)
    const registrationRate = Math.min((totalRegistered / totalCapacity) * 100, 100).toFixed(1);
    const attendanceRate = totalRegistered > 0 
      ? ((totalCheckedIn / totalRegistered) * 100).toFixed(1) 
      : 0;

      const feedbacksList = activeRegistrations
      .filter(r => (r as any).feedback && (r as any).feedback.trim() !== '')
      .map(r => ({
        rating: (r as any).rating,
        text: (r as any).feedback
      }));

res.json({
      success: true,
      data: {
        registrationRate: Number(registrationRate),
        attendanceRate: Number(attendanceRate),
        averageRating: Number(averageRating),
        totalRegistered,
        totalCheckedIn,
        totalCapacity,
        feedbackCount: ratings.length,
        feedbacksList // 👈 就是漏了這一行！把它塞進 data 包裹裡寄出去
      }
    });

  } catch (error) {
    console.error('儀表板數據獲取失敗:', error);
    res.status(500).json({ success: false, error: '伺服器錯誤' });
  }
});

// 創新 B 方案：推薦引擎 API
app.get('/api/recommendations', async (req, res) => {
  try {
    const studentId = parseInt(req.query.studentId as string, 10);
    if (isNaN(studentId)) {
      return res.status(400).json({ error: '缺少或無效的學生 ID' });
    }
    const recommendations = await getDepartmentRecommendations(studentId);
    return res.status(200).json({ success: true, data: recommendations });
  } catch (error) {
    console.error('推薦引擎 API 發生錯誤:', error);
    return res.status(500).json({ error: '伺服器內部錯誤' });
  }
});

app.get('/api/recommendations/activities', async (req, res) => {
  try {
    const studentId = Number(req.query.studentId);
    if (!studentId) {
      return res.status(400).json({ success: false, error: '需要 studentId 參數' });
    }

    const data = await getActivityRecommendations(studentId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('取得活動推薦失敗:', error);
    res.status(500).json({ success: false, error: '伺服器內部錯誤' });
  }
});

app.patch('/api/users/profile', async (req, res) => {
  try {
    const { userId, email, phone, password } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: '缺少使用者 ID' });
    }

    const updateData: any = {};
    if (password) {
      const [user] = await db.select({
        name: users.name,
        email: users.email,
        studentId: users.studentId,
        birthday: users.birthday,
        phone: users.phone,
      }).from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(404).json({ success: false, error: '找不到使用者資料' });
      }
      const passwordError = validatePassword(password, [
        user.name, user.email, user.studentId, user.birthday, user.phone, email, phone,
      ]);
      if (passwordError) {
        return res.status(400).json({ success: false, error: passwordError });
      }
    }
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (password) updateData.password = password; 

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, error: '沒有提供任何可更新的資料' });
    }

    await db.update(users).set(updateData).where(eq(users.id, userId));
    res.json({ success: true, message: '個人資料更新成功！' });
  } catch (error) {
    console.error('更新個人資料失敗:', error);
    res.status(500).json({ success: false, error: '伺服器內部錯誤' });
  }
});

app.patch('/api/admin/users/:targetId', async (req, res) => {
  try {
    const targetId = Number(req.params.targetId);
    const { name, gender, birthday, email, phone, password } = req.body;

    const updatedData: any = {};
    if (password) {
      const [user] = await db.select({
        name: users.name,
        email: users.email,
        studentId: users.studentId,
        birthday: users.birthday,
        phone: users.phone,
      }).from(users).where(eq(users.id, targetId));
      if (!user) {
        return res.status(404).json({ success: false, error: '找不到使用者資料' });
      }
      const passwordError = validatePassword(password, [
        user.name, user.email, user.studentId, user.birthday, user.phone,
        req.body.email, req.body.phone, req.body.name, req.body.birthday,
      ]);
      if (passwordError) {
        return res.status(400).json({ success: false, error: passwordError });
      }
    }
    if (name) updatedData.name = name;
    if (gender) updatedData.gender = gender;
    
    if (birthday !== undefined && birthday !== '') {
      updatedData.birthday = birthday;
    }
    
    if (email) updatedData.email = email;
    if (phone) updatedData.phone = phone;
    if (password) updatedData.password = password;

    if (Object.keys(updatedData).length === 0) {
      return res.status(400).json({ success: false, error: '沒有提供任何可更新的資料' });
    }

    await db.update(users).set(updatedData).where(eq(users.id, targetId));
    res.json({ success: true, message: '管理員強制更新資料成功！' });
    
  } catch (error) {
    console.error('管理員更新資料失敗:', error);
    res.status(500).json({ success: false, error: '伺服器內部錯誤' });
  }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    const allUsers = await db.select().from(users).orderBy(users.id);
    res.json({ success: true, data: allUsers });
  } catch (error) {
    console.error('獲取使用者列表失敗:', error);
    res.status(500).json({ success: false, error: '伺服器內部錯誤' });
  }
});

// 學生送出評分與評論 API
// 學生送出評分與評論 API (自動翻譯學號版)
app.post('/api/events/:eventId/rate', async (req, res) => {
  try {
    const eventId = Number(req.params.eventId);
    const { studentId, rating, feedback } = req.body; 

    // 1. 先用前端傳來的學號，去 users 資料表查出他的「內部流水號」
    // (注意：如果你上方沒有 import users，記得要像 import registrations 一樣把它引入)
    const [userRecord] = await db.select().from(users).where(eq(users.studentId, String(studentId)));
    
    if (!userRecord) {
      return res.status(400).json({ success: false, error: '找不到該學號的會員資料' });
    }

    const internalUserId = userRecord.id; // 成功翻譯！這就是我們要的 1, 2, 5 或是 7

    // 2. 拿這個真正的內部 ID 去找報名紀錄
    const [reg] = await db.select().from(registrations).where(
      and(
        eq(registrations.eventId, eventId),
        eq(registrations.userId, internalUserId)
      )
    );

    if (!reg) {
      return res.status(400).json({ success: false, error: '找不到你的報名紀錄，無法評分' });
    }

    // 3. 找到人了，寫入星星跟留言！
    await db.update(registrations)
      .set({ rating, feedback }) 
      .where(eq(registrations.id, reg.id));

    res.json({ success: true, message: '評分成功' });
  } catch (error) {
    console.error('評分發生嚴重錯誤:', error);
    res.status(500).json({ success: false, error: '伺服器錯誤' });
  }
});


// 🔥 WebSocket 邏輯 (完全移植為 PostgreSQL 相容)
io.on('connection', (socket) => {
  console.log('連線建立:', socket.id);

  socket.on('fetch_all_events', async () => {
    try {
      socket.emit('all_events_data', { events: await getEventsWithRegistrationCounts() });
    } catch (e) { console.error(e); }
  });

socket.on('host_create_event', async (data) => {
    if (data?.role !== '教師') {
      socket.emit('create_event_error', { msg: '只有教師可以新增活動' });
      return;
    }
  if (![data.organizer, data.target, data.category, data.campus].every(value => String(value || '').trim())) {
    socket.emit('create_event_error', { msg: '請選擇主辦單位、對象、類別及校區' });
    return;
  }
  try {
      await db.insert(events).values({
        title: data.title,
        description: data.description,
        eventDate: data.dateRange,
        registrationStart: data.registrationStart,
        registrationEnd: data.registrationEnd,
        organizer: data.organizer,
        target: data.target,
        category: data.category,
        campus: data.campus,
        contactPerson: data.contactPerson,
        contactPhone: data.contactPhone,
        contactEmail: data.contactEmail,
        locationName: data.locationName || null,
        fee: Number(data.fee) || 0,
        capacity: Number(data.capacity) || 50, // 👉 這裡接住前端傳來的人數
        locationLat: data.lat,
        locationLng: data.lng,
        currentCheckInCode: '000000',
        isCheckInActive: true
      });
      await emitEventsWithRegistrationCounts();
      socket.emit('create_event_success', { success: true }); 
    } catch (error) { 
      console.error('新增活動失敗:', error);
      socket.emit('create_event_error', { msg: '新增活動失敗，請確認資料庫已套用活動欄位升級 SQL。' }); 
    }
  });

  socket.on('get_user_registrations', async ({ studentId }) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.studentId, String(studentId)));
      if (user) {
        const regs = await db.select().from(registrations).where(eq(registrations.userId, user.id));
        const registrationMap: Record<number, { registered: boolean, checkedIn: boolean }> = {};
        regs.forEach(r => {
          if (r.eventId !== null && r.status !== 'payment_pending' && r.status !== 'cancelled') {
            registrationMap[r.eventId] = { registered: true, checkedIn: Boolean(r.isCheckedIn) };
          }
        });
        socket.emit('user_registrations_sync', { registrationMap });
      } else {
        socket.emit('user_registrations_sync', { registrationMap: {} });
      }
    } catch (e) { console.error(e); }
  });

  socket.on('get_event_stats', async ({ eventId }) => {
    try {
      const [event] = await db.select().from(events).where(eq(events.id, eventId));
      if (!event) return;
      const allRegistrations = await db.select().from(registrations)
        .where(and(eq(registrations.eventId, eventId), eq(registrations.isCheckedIn, true)));
      socket.emit('code_sync', { eventId, code: event.currentCheckInCode });
      socket.emit('attendee_update', { count: allRegistrations.length });
      socket.emit('check_in_settings_sync', {
        eventId,
        bluetoothCheckInRequired: event.bluetoothCheckInRequired,
        bluetoothBeaconName: event.bluetoothBeaconName,
        bluetoothServiceUuid: event.bluetoothServiceUuid,
      });
    } catch (e) { console.error(e); }
  });

  socket.on('host_update_code', async (data) => {
    const { eventId, newCode } = data;
    await db.update(events).set({ currentCheckInCode: newCode }).where(eq(events.id, eventId));
    io.emit('code_sync', { eventId, code: newCode });
  });

  socket.on('host_update_location', async (data) => {
    const { eventId, lat, lng } = data;
    await db.update(events).set({ locationLat: lat, locationLng: lng }).where(eq(events.id, eventId));
    socket.emit('location_update_success', { success: true, msg: '地點設定完成' });
  });

  socket.on('host_manual_check_in', async (data) => {
    const { userId: inputStudentId, eventId } = data;
    const cleanStudentId = String(inputStudentId).trim(); 
    try {
      const [event] = await db.select().from(events).where(eq(events.id, eventId));
      if (!event) { socket.emit('check_in_result', { success: false, msg: '找不到活動', source: 'host' }); return; }

let [targetUser] = await db.select().from(users).where(eq(users.studentId, cleanStudentId));

if (!targetUser) {
  // 🚨 砍掉原本的 insert，改成 emit 錯誤訊息
  socket.emit('check_in_result', { 
    success: false, 
    msg: '找不到此學生，請該生先登入系統建立資料！',
    source: 'host'
  });
  return; // 務必 return，避免繼續往下執行
}

      const [existingCheckIn] = await db.select().from(registrations)
        .where(and(eq(registrations.userId, targetUser.id), eq(registrations.eventId, eventId)));

      let msg = '補登成功';
      if (existingCheckIn) {
        if (!existingCheckIn.isCheckedIn) {
          await db.update(registrations).set({ isCheckedIn: true, checkInTime: new Date().toISOString() })
            .where(eq(registrations.id, existingCheckIn.id));
          msg = '補登成功 (已更新為簽到)';
        } else {
          msg = '該學生先前已完成簽到';
        }
      } else {
        await db.insert(registrations).values({
          userId: targetUser.id, 
          eventId: eventId, 
          status: 'checked_in', 
          isCheckedIn: true, 
          checkInTime: new Date().toISOString(),
        });
      }

      socket.emit('check_in_result', { success: true, msg, source: 'host' });
      const allRegistrations = await db.select().from(registrations)
        .where(and(eq(registrations.eventId, eventId), eq(registrations.isCheckedIn, true)));
      io.emit('attendee_update', { count: allRegistrations.length });
      io.emit('force_refresh_registrations', { studentId: cleanStudentId, eventId: eventId }); 
      await emitEventsWithRegistrationCounts();
    } catch (e) {
      socket.emit('check_in_result', { success: false, msg: '系統錯誤', source: 'host' });
    }
  });

  socket.on('student_register', async (data) => {
    const { userId: inputStudentId, eventId } = data;
    const cleanStudentId = String(inputStudentId).trim();
    try {
     let [targetUser] = await db.select().from(users).where(eq(users.studentId, cleanStudentId));

if (!targetUser) {
  // 🚨 砍掉原本的 insert，提醒學生先去登入
  socket.emit('check_in_result', { // 依據你前端接的事件名稱調整
    success: false, 
    msg: '系統無您的帳號資料，請先透過 Google 登入完成註冊！' 
  });
  return; 
}

      const [existing] = await db.select().from(registrations)
        .where(and(eq(registrations.userId, targetUser.id), eq(registrations.eventId, eventId)));

      if (!existing) {
        await db.insert(registrations).values({
          userId: targetUser.id, 
          eventId: eventId, 
          status: 'registered', 
          isCheckedIn: false, 
          checkInTime: null,
        });
      }

      io.emit('force_refresh_registrations', { studentId: cleanStudentId, eventId: eventId });
      await emitEventsWithRegistrationCounts();
    } catch(e) { console.error(e); }
  });

  socket.on('guest_check_in', async (data) => { 
    const { userId: inputStudentId, eventId, inputCode, userLat, userLng, bluetoothDeviceName, bluetoothServiceUuid } = data;
    const cleanStudentId = String(inputStudentId).trim();
    try {
      const [event] = await db.select().from(events).where(eq(events.id, eventId));
      if (!event) { socket.emit('check_in_result', { success: false, msg: `找不到活動`, source: 'guest' }); return; }

      if (event.currentCheckInCode !== inputCode) {
        socket.emit('check_in_result', { success: false, msg: '❌ 驗證碼錯誤', source: 'guest' });
        return;
      }

      const hasGpsCoordinates =
        typeof userLat === 'number' &&
        typeof userLng === 'number' &&
        typeof event.locationLat === 'number' &&
        typeof event.locationLng === 'number' &&
        Number.isFinite(userLat) &&
        Number.isFinite(userLng) &&
        Number.isFinite(event.locationLat) &&
        Number.isFinite(event.locationLng);
      if (event.bluetoothCheckInRequired && !hasGpsCoordinates) {
        socket.emit('check_in_result', { success: false, msg: '❌ 無法確認定位，請先完成 GPS 定位並確認活動地點已設定', source: 'guest' });
        return;
      }
      if (
        typeof userLat === 'number' &&
        typeof userLng === 'number' &&
        typeof event.locationLat === 'number' &&
        typeof event.locationLng === 'number' &&
        Number.isFinite(userLat) &&
        Number.isFinite(userLng) &&
        Number.isFinite(event.locationLat) &&
        Number.isFinite(event.locationLng)
      ) {
        const distance = getDistanceFromLatLonInM(userLat, userLng, event.locationLat, event.locationLng);
        if (distance > 500) {
          socket.emit('check_in_result', { success: false, msg: `❌ 距離太遠！(${distance.toFixed(0)}m)`, source: 'guest' });
          return;
        }
      }

      if (event.bluetoothCheckInRequired) {
        const expectedName = String(event.bluetoothBeaconName || '').trim();
        const expectedUuid = String(event.bluetoothServiceUuid || '').trim().toLowerCase();
        const receivedName = String(bluetoothDeviceName || '').trim();
        const receivedUuid = String(bluetoothServiceUuid || '').trim().toLowerCase();
        if (!expectedName && !expectedUuid) {
          socket.emit('check_in_result', { success: false, msg: '❌ 活動尚未設定藍牙設備名稱或 Service UUID', source: 'guest' });
          return;
        }
        if ((expectedName && receivedName !== expectedName) || (expectedUuid && receivedUuid !== expectedUuid)) {
          socket.emit('check_in_result', { success: false, msg: '❌ 藍牙設備驗證未通過，請連線至本活動指定設備', source: 'guest' });
          return;
        }
      }

      let [targetUser] = await db.select().from(users).where(eq(users.studentId, cleanStudentId));
      if (!targetUser) {
        socket.emit('check_in_result', { success: false, msg: '❌ 找不到該學生', source: 'guest' });
        return;
      }

      const [existingCheckIn] = await db.select().from(registrations)
        .where(and(eq(registrations.userId, targetUser.id), eq(registrations.eventId, eventId)));

      if (existingCheckIn) {
        if (!existingCheckIn.isCheckedIn) {
          await db.update(registrations).set({ isCheckedIn: true, checkInTime: new Date().toISOString() })
            .where(eq(registrations.id, existingCheckIn.id));
        }
      } else {
        await db.insert(registrations).values({
          userId: targetUser.id, 
          eventId: eventId, 
          status: 'checked_in', 
          isCheckedIn: true, 
          checkInTime: new Date().toISOString(),
        });
      }

      socket.emit('check_in_result', { success: true, msg: '✅ 簽到成功！', source: 'guest' });
      const allRegistrations = await db.select().from(registrations)
        .where(and(eq(registrations.eventId, eventId), eq(registrations.isCheckedIn, true)));

      io.emit('attendee_update', { count: allRegistrations.length });
      io.emit('force_refresh_registrations', { studentId: cleanStudentId, eventId: eventId });
      await emitEventsWithRegistrationCounts();
    } catch (e) {
      socket.emit('check_in_result', { success: false, msg: '系統錯誤', source: 'guest' });
    }
  });
});

function startServer(port: number) {
  httpServer.listen(port, async () => {
    console.log(`🚀 後端伺服器啟動 (PostgreSQL): http://localhost:${port}`);
    await verifyMailConnection();
  });
} 

let currentPort = Number(process.env.PORT || 3000);

httpServer.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    currentPort += 1;
    console.error(`⚠️ Port in use, switching to ${currentPort}`);
    startServer(currentPort);
    return;
  }
});

startServer(currentPort);


// ==========================================
// 🚀 嚴格區分教職員與學生的真實登入 API
// ==========================================
app.post('/api/users/login', async (req, res) => {
  try {
    const { account, password } = req.body;

    // 顯式宣告型別為 any，消除 TypeScript 紅線
    let user: any = null;

    // 1. 檢查這是不是教職員帳號 (開頭是 T 或 t)
    if (account.startsWith('T') || account.startsWith('t')) {
      user = {
        id: account,
        studentId: account,
        email: `${account.toLowerCase()}@ntub.edu.tw`,
        name: '徐國鈞', // 教職員名字固定為徐國鈞
        role: '教師'
      };
    } else {
      // 2. 一般學生帳號，從資料庫的 users 表撈資料（會抓到你在後台改成「吳承恩」的最新名字）
      const [studentUser] = await db.select().from(users).where(eq(users.studentId, account));
      if (studentUser) {
        user = {
          ...studentUser,
          role: '資管系學生'
        };
      }
    }

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: '找不到此帳號，請確認資料庫是否有建立該筆資料！' 
      });
    }

    res.json({ 
      success: true, 
      data: user 
    });

  } catch (error) {
    console.error('登入 API 發生錯誤:', error);
    res.status(500).json({ success: false, error: '伺服器內部錯誤' });
  }
});