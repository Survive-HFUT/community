-- 清理已移除的设置项：worker_display / spam_mode / akismet_key。
--
-- 全新数据库无需执行本文件（这些键从不会写入；设置接口也只回传白名单内的键）。
-- 这份脚本用于把旧库里已经存在的行删掉，避免残留真实的 Akismet key 留在表中。
--
-- 执行：
--   本地：pnpm exec wrangler d1 execute waline-db --local --file=./layers/waline/migrations/0002-drop-worker-and-spam-settings.sql
--   远程：pnpm exec wrangler d1 execute waline-db --remote --file=./layers/waline/migrations/0002-drop-worker-and-spam-settings.sql

-- Worker 信息显示：控制「Waline on Worker」标识，本项目已不再使用。
-- 反垃圾：Akismet 能力已整体删除，评论不再有自动反垃圾，这两个键也不会再被读取。
DELETE FROM "wl_Settings"
WHERE "key" IN ('worker_display', 'spam_mode', 'akismet_key');
