-- Waline on Cloudflare D1 —— 建表脚本
--
-- 与上游 Waline 的 SQLite 结构兼容（wl_Comment / wl_Users / wl_Settings / wl_OAuthCode）。
--
-- 执行：
--   本地：pnpm db:init:local
--   远程：pnpm db:init

CREATE TABLE IF NOT EXISTS "wl_Comment" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "user_id" INTEGER,
  "comment" TEXT,
  "orig" TEXT,
  "insertedAt" TEXT DEFAULT (datetime('now')),
  "ip" TEXT,
  "link" TEXT,
  "mail" TEXT,
  "nick" TEXT,
  "pid" INTEGER,
  "rid" INTEGER,
  "sticky" INTEGER DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'approved',
  "like" INTEGER DEFAULT 0,
  "ua" TEXT,
  "url" TEXT,
  "createdAt" TEXT DEFAULT (datetime('now')),
  "updatedAt" TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_comment_url" ON "wl_Comment" ("url");
CREATE INDEX IF NOT EXISTS "idx_comment_status" ON "wl_Comment" ("status");
CREATE INDEX IF NOT EXISTS "idx_comment_rid" ON "wl_Comment" ("rid");
CREATE INDEX IF NOT EXISTS "idx_comment_pid" ON "wl_Comment" ("pid");
CREATE INDEX IF NOT EXISTS "idx_comment_user_id" ON "wl_Comment" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_comment_insertedAt" ON "wl_Comment" ("insertedAt");

CREATE TABLE IF NOT EXISTS "wl_Users" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "display_name" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL DEFAULT '',
  "password" TEXT NOT NULL DEFAULT '',
  "type" TEXT NOT NULL DEFAULT 'guest',
  "label" TEXT DEFAULT '',
  "url" TEXT DEFAULT '',
  "avatar" TEXT DEFAULT '',
  "github" TEXT DEFAULT '',
  "twitter" TEXT DEFAULT '',
  "facebook" TEXT DEFAULT '',
  "google" TEXT DEFAULT '',
  "weibo" TEXT DEFAULT '',
  "qq" TEXT DEFAULT '',
  "2fa" TEXT DEFAULT '',
  "notify_admin_comment" INTEGER NOT NULL DEFAULT 1,
  "notify_reply" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT DEFAULT (datetime('now')),
  "updatedAt" TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_email" ON "wl_Users" ("email");

CREATE TABLE IF NOT EXISTS "wl_Settings" (
  "key" TEXT PRIMARY KEY,
  "value" TEXT NOT NULL DEFAULT '',
  "updatedAt" TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "wl_OAuthCode" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "code" TEXT NOT NULL,
  "client_id" TEXT NOT NULL DEFAULT '',
  "redirect_uri" TEXT NOT NULL,
  "code_challenge" TEXT NOT NULL,
  "code_challenge_method" TEXT NOT NULL DEFAULT 'S256',
  "user_id" INTEGER NOT NULL,
  "scope" TEXT NOT NULL DEFAULT '',
  "state" TEXT NOT NULL DEFAULT '',
  "expires_at" INTEGER NOT NULL,
  "used_at" INTEGER,
  "createdAt" TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_oauth_code_code" ON "wl_OAuthCode" ("code");
CREATE INDEX IF NOT EXISTS "idx_oauth_code_expires_at" ON "wl_OAuthCode" ("expires_at");
