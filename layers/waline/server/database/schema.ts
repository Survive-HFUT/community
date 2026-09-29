/**
 * Drizzle schema —— 与 `layers/waline/schema.sql` 中的业务表一一对应。
 *
 * 约定：**TS 属性名与数据库列名保持一致**（包括 `like` / `2fa` / `display_name`
 * 这类非 camelCase 的列），这样 Drizzle 查出来的行对象与改造前 `D1Result.results`
 * 的形状完全一致，业务层不需要做任何字段改名。
 *
 * 列上的 `default(sql`(datetime('now'))`)` 只是声明式描述，真正的建表仍由
 * `schema.sql` 负责（`pnpm db:init` / `pnpm db:init:local`），两者需保持同步。
 */
import { sql } from 'drizzle-orm';
import {
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

/** 每次调用生成一个新的 `datetime('now')` 片段（避免复用同一个 SQL 实例） */
const now = () => sql`(datetime('now'))`;

// ---------- wl_Comment ----------

export const comments = sqliteTable('wl_Comment', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id'),
  comment: text('comment'),
  orig: text('orig'),
  insertedAt: text('insertedAt').default(now()),
  ip: text('ip'),
  link: text('link'),
  mail: text('mail'),
  nick: text('nick'),
  pid: integer('pid'),
  rid: integer('rid'),
  sticky: integer('sticky').default(0),
  status: text('status').notNull().default('approved'),
  like: integer('like').default(0),
  ua: text('ua'),
  url: text('url'),
  createdAt: text('createdAt').default(now()),
  updatedAt: text('updatedAt').default(now()),
});

// ---------- wl_Users ----------

export const users = sqliteTable(
  'wl_Users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    display_name: text('display_name').notNull().default(''),
    email: text('email').notNull().default(''),
    password: text('password').notNull().default(''),
    type: text('type').notNull().default('guest'),
    label: text('label').default(''),
    url: text('url').default(''),
    avatar: text('avatar').default(''),
    github: text('github').default(''),
    twitter: text('twitter').default(''),
    facebook: text('facebook').default(''),
    google: text('google').default(''),
    weibo: text('weibo').default(''),
    qq: text('qq').default(''),
    '2fa': text('2fa').default(''),
    notify_admin_comment: integer('notify_admin_comment').notNull().default(1),
    notify_reply: integer('notify_reply').notNull().default(1),
    createdAt: text('createdAt').default(now()),
    updatedAt: text('updatedAt').default(now()),
  },
  (t) => [uniqueIndex('idx_users_email').on(t.email)],
);

// ---------- wl_Settings ----------

export const settings = sqliteTable('wl_Settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull().default(''),
  updatedAt: text('updatedAt').default(now()),
});

// ---------- wl_OAuthCode ----------

export const oauthCodes = sqliteTable(
  'wl_OAuthCode',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    code: text('code').notNull(),
    client_id: text('client_id').notNull().default(''),
    redirect_uri: text('redirect_uri').notNull(),
    code_challenge: text('code_challenge').notNull(),
    code_challenge_method: text('code_challenge_method')
      .notNull()
      .default('S256'),
    user_id: integer('user_id').notNull(),
    scope: text('scope').notNull().default(''),
    state: text('state').notNull().default(''),
    expires_at: integer('expires_at').notNull(),
    used_at: integer('used_at'),
    createdAt: text('createdAt').default(now()),
  },
  (t) => [uniqueIndex('idx_oauth_code_code').on(t.code)],
);

// ---------- elective_courses ----------

/** 选修课评价使用的课程主数据。课程名 + 教师是业务上的唯一身份。 */
export const electiveCourses = sqliteTable(
  'elective_courses',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    teacher: text('teacher').notNull(),
    type: text('type').notNull(),
    campus: text('campus').notNull(),
    category: text('category'),
    createdAt: text('createdAt').notNull().default(now()),
    updatedAt: text('updatedAt').notNull().default(now()),
  },
  (t) => [uniqueIndex('idx_elective_courses_identity').on(t.name, t.teacher)],
);

// ---------- elective_reviews ----------

/** 选修课评价明细；评分使用 REAL 以支持界面上的半星。 */
export const electiveReviews = sqliteTable('elective_reviews', {
  id: text('id').primaryKey(),
  courseId: text('course_id').notNull(),
  userId: integer('user_id').notNull(),
  term: text('term').notNull(),
  reviewerName: text('reviewer_name').notNull(),
  reviewerAvatar: text('reviewer_avatar'),
  learnEase: real('learn_ease').notNull(),
  highScoreEase: real('high_score_ease').notNull(),
  checkinEase: real('checkin_ease').notNull(),
  homeworkEase: real('homework_ease').notNull(),
  examEase: real('exam_ease').notNull(),
  questions: integer('questions'),
  /** JSON 编码的 AssessmentForm[]，服务端写入前会做白名单校验。 */
  assessment: text('assessment').notNull().default('[]'),
  comment: text('comment'),
  createdAt: text('createdAt').notNull().default(now()),
});

// ---------- 推导类型 ----------

export type CommentRow = typeof comments.$inferSelect;
export type CommentInsert = typeof comments.$inferInsert;
export type UserRow = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;
export type SettingRow = typeof settings.$inferSelect;
export type OAuthCodeRow = typeof oauthCodes.$inferSelect;
export type OAuthCodeInsert = typeof oauthCodes.$inferInsert;
export type ElectiveCourseRow = typeof electiveCourses.$inferSelect;
export type ElectiveCourseInsert = typeof electiveCourses.$inferInsert;
export type ElectiveReviewRow = typeof electiveReviews.$inferSelect;
export type ElectiveReviewInsert = typeof electiveReviews.$inferInsert;

/** 允许动态赋值给用户的社交列（其他字段名一律忽略，避免 SQL 注入） */
export const USER_SOCIAL_COLUMNS = {
  github: users.github,
  twitter: users.twitter,
  facebook: users.facebook,
  google: users.google,
  weibo: users.weibo,
  qq: users.qq,
} as const;

export type UserSocialField = keyof typeof USER_SOCIAL_COLUMNS;
