-- 选修课评价持久化表
--
-- 本地：pnpm db:migrate:electives:local
-- 远程：pnpm db:migrate:electives

CREATE TABLE IF NOT EXISTS "elective_courses" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "teacher" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "campus" TEXT NOT NULL,
  "category" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_elective_courses_identity"
  ON "elective_courses" ("name", "teacher");

CREATE TABLE IF NOT EXISTS "elective_reviews" (
  "id" TEXT PRIMARY KEY,
  "course_id" TEXT NOT NULL,
  "user_id" INTEGER NOT NULL,
  "term" TEXT NOT NULL,
  "reviewer_name" TEXT NOT NULL,
  "reviewer_avatar" TEXT,
  "learn_ease" REAL NOT NULL,
  "high_score_ease" REAL NOT NULL,
  "checkin_ease" REAL NOT NULL,
  "homework_ease" REAL NOT NULL,
  "exam_ease" REAL NOT NULL,
  "questions" INTEGER,
  "assessment" TEXT NOT NULL DEFAULT '[]',
  "comment" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_elective_reviews_course_id"
  ON "elective_reviews" ("course_id");
CREATE INDEX IF NOT EXISTS "idx_elective_reviews_user_id"
  ON "elective_reviews" ("user_id");
