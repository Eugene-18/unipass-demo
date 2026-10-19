// server/src/db/schema.ts
import { pgTable, serial, integer, text, timestamp, real, varchar, boolean ,primaryKey, decimal, date} from "drizzle-orm/pg-core";

// ==========================================
// T01. users (使用者)
// ==========================================
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  
  // 💡 [系統文件新增]
  passwordHash: text('password_hash'),
  googleId: text('google_id').unique(),
  
  name: text('name').notNull(),
  role: text('role').default('student'), // student, admin
  createdAt: timestamp('created_at').defaultNow(),

  // 🔥 [個人資料功能新增]
  gender: varchar('gender', { length: 10 }), // 性別 (僅管理員可改)
  birthday: date('birthday'), // 生日 (僅管理員可改)
  phone: varchar('phone', { length: 20 }), // 電話 (開放修改)

  // 🛡️ [向下相容 POC 後端] 絕對不能刪除的舊欄位
  password: text('password'), 
  studentId: text('student_id'), 
  passwordResetToken: text('password_reset_token'), 
  passwordResetTokenExpiry: text('password_reset_token_expiry'),
  
});

// ==========================================
// T02. registrations (報名紀錄)
// ==========================================
export const registrations = pgTable('registrations', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  eventId: integer('event_id').references(() => events.id), // 注意這裡會參考到底下的 T03 events，因為 JavaScript 變數提昇 (Hoisting) 特性或改用字串關聯，但目前先維持原樣
  status: text('status').default('registered'),
  checkInTime: text('check_in_time'),
  
  // 💡 [系統文件新增] + 動態欄位
  customAnswers: text('custom_answers'), // 儲存 JSON 字串
  appliedAt: text('applied_at'),
  documentUrl: text('document_url'),
  preferenceRank: integer('preference_rank'),
  amount: integer('amount'),
  paymentTime: text('payment_time'),
  accountLastFive: text('account_last_five'),
  rating: integer('rating'), // 新增這行：1~5 分
  feedback: text('feedback'), // (可選) 也可以順便加個文字回饋欄位

  // 🛡️ [向下相容 POC 後端]
  isCheckedIn: boolean('is_checked_in').default(false),
});

// ==========================================
// T03. events (活動/項目主表)
// ==========================================
export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  
  // 💡 [系統文件新增]
  startDate: text('start_date'),
  endDate: text('end_date'),
  status: text('status'),
  
  // 👉 新增費用欄位 (預設為 0 代表免費)
  fee: integer('fee').default(0).notNull(),
  
  // 🛡️ [向下相容 POC 後端] 舊有的時間與簽到驗證邏輯
  eventDate: text('event_date'), 
  registrationStart: text('registration_start'),
  registrationEnd: text('registration_end'),
  organizer: text('organizer'),
  target: text('target'),
  category: text('category'),
  campus: text('campus'),
  contactPerson: text('contact_person'),
  contactPhone: text('contact_phone'),
  contactEmail: text('contact_email'),
  locationName: text('location_name'),
  locationLat: real('location_lat'),   
  locationLng: real('location_lng'),   
  allowedDistance: integer('allowed_distance').default(500), 
  currentCheckInCode: text('current_check_in_code').default('000000'),
  isCheckInActive: boolean('is_check_in_active').default(false),
  bluetoothCheckInRequired: boolean('bluetooth_check_in_required').default(false).notNull(),
  bluetoothBeaconName: text('bluetooth_beacon_name'),
  bluetoothServiceUuid: text('bluetooth_service_uuid'),
  capacity: integer('capacity').default(50).notNull(),
});

// ==========================================
// T04. location_logs (位置紀錄) - 全新
// ==========================================
export const locationLogs = pgTable('location_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  latitude: real('latitude'),
  longitude: real('longitude'),
  timestamp: timestamp('timestamp').defaultNow(),
});

// ==========================================
// T05. bluetooth_devices (藍牙設備) - 全新
// ==========================================
export const bluetoothDevices = pgTable('bluetooth_devices', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  macAddress: text('mac_address').unique(),
  deviceName: text('device_name'),
  lastConnectedAt: text('last_connected_at'),
});

// ==========================================
// T06. password_resets (密碼重設紀錄) - 全新
// ==========================================
export const passwordResets = pgTable('password_resets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  otpCode: text('otp_code'),
  expiresAt: text('expires_at'),
  isUsed: boolean('is_used').default(false),
});

// ==========================================
// T07. reviews (審查評分表) - 全新
// ==========================================
export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  registrationId: integer('registration_id').references(() => registrations.id),
  reviewerId: integer('reviewer_id').references(() => users.id),
  score: integer('score'),
  comment: text('comment'),
});

// ==========================================
// T08. predictions (預測分析表) - 全新
// ==========================================
export const predictions = pgTable('predictions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  eventId: integer('event_id').references(() => events.id),
  probabilityScore: real('probability_score'),
  predictedStatus: text('predicted_status'),
  currentDynamicRank: integer('current_dynamic_rank'),
  historicalReference: text('historical_reference'),
  calculatedAt: timestamp('calculated_at').defaultNow(),
});

// ==========================================
// T09. students (考生基本資料表)
// ==========================================
export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull(),
  idNumber: varchar("id_number", { length: 15 }).notNull().unique(),
  email: varchar("email", { length: 100 }).notNull().unique(),
  phoneCode: varchar("phone_code", { length: 5 }).notNull(),
  phoneNumber: varchar("phone_number", { length: 15 }).notNull(),
});

// ==========================================
// T10. applications (報名主檔與審查狀態)
// ==========================================
export const applications = pgTable("applications", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").references(() => students.id).notNull(),
  serialNumber: varchar("serial_number", { length: 50 }).notNull().unique(),
  programType: varchar("program_type", { length: 30 }).notNull(),
  identityType: varchar("identity_type", { length: 30 }).notNull(),
  
  choice1: varchar("choice_1", { length: 20 }),
  choice2: varchar("choice_2", { length: 20 }),
  choice3: varchar("choice_3", { length: 20 }),
  choice4: varchar("choice_4", { length: 20 }),
  
  paymentAmount: integer("payment_amount").default(500).notNull(),
  paymentStatus: varchar("payment_status", { length: 20 }).default("UNPAID").notNull(),
  reviewStatus: varchar("review_status", { length: 20 }).default("PENDING").notNull(),
  appliedAt: timestamp("applied_at").defaultNow().notNull(),
});

// ==========================================
// T11. application_documents (書審資料上傳表)
// ==========================================
export const applicationDocuments = pgTable("application_documents", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").references(() => applications.id).notNull(),
  documentType: varchar("document_type", { length: 30 }).notNull(),
  isRequired: boolean("is_required").default(true).notNull(),
  fileUrl: varchar("file_url", { length: 255 }),
  status: varchar("status", { length: 20 }).default("PENDING").notNull(),
});


// ==========================================
// 創新 B 方案：AI 適性探索與科系推薦模型
// ==========================================

// ==========================================
// T12. tags (標籤字典) - 能力與興趣維度
// ==========================================
export const tags = pgTable('tags', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull().unique(),
  dimension: varchar('dimension', { length: 50 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ==========================================
// T13. activity_tags (活動與標籤權重關聯表)
// ==========================================
export const activityTags = pgTable('activity_tags', {
  activityId: integer('activity_id').notNull(),
  tagId: integer('tag_id').notNull().references(() => tags.id),
  weight: decimal('weight', { precision: 3, scale: 2 }).default('1.00').notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.activityId, table.tagId] }),
}));

// ==========================================
// T14. department_profiles (科系需求模型表)
// ==========================================
export const departmentProfiles = pgTable('department_profiles', {
  id: serial('id').primaryKey(),
  deptName: varchar('dept_name', { length: 100 }).notNull(),
  college: varchar('college', { length: 100 }).notNull(),
  tagId: integer('tag_id').notNull().references(() => tags.id),
  requiredWeight: decimal('required_weight', { precision: 3, scale: 2 }).notNull(),
});

// ==========================================
// T15. student_feature_cache (學生個人特質快取表)
// ==========================================
export const studentFeatureCache = pgTable('student_feature_cache', {
  studentId: integer('student_id').notNull().references(() => students.id),
  tagId: integer('tag_id').notNull().references(() => tags.id),
  score: decimal('score', { precision: 5, scale: 2 }).default('0.00').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.studentId, table.tagId] }),
}));
