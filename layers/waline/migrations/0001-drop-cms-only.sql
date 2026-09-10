-- 从「带 notify_approve / cms_* 的旧库」升级到本项目的结构时执行。
--
-- 全新数据库无需执行本文件（schema.sql 已包含最终结构，且不含 wl_Counter / cms_* 表）。
--
-- 执行：
--   本地：pnpm wrangler d1 execute waline-db --local --file=./layers/waline/migrations/0001-drop-cms-only.sql
--   远程：pnpm wrangler d1 execute waline-db --remote --file=./layers/waline/migrations/0001-drop-cms-only.sql

-- notify_approve 仅服务于已移除的 CMS「文档提交审批」通知，本项目不再使用。
-- SQLite 3.35+ 支持 DROP COLUMN；D1 已支持。
ALTER TABLE "wl_Users" DROP COLUMN "notify_approve";

-- 本项目不提供流量统计，移除计数器表（若旧库存在）。
DROP TABLE IF EXISTS "wl_Counter";
