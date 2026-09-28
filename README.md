# 活在肥宣社区

## Layers

不同业务通过 Nuxt layers 进行注册和管理

- `layers/waline` - Waline 后端服务
- `layers/electives` - 选修课评价

### 数据库

选修课课程、教务处目录与用户评价使用同一个 D1。官方目录存储在
`elective_course_catalog`，通过 `migrations/2026-09-28-elective-course-catalog.sql`
版本化更新，不在 Worker 运行时硬编码。已有 Waline 数据库的环境先执行
`pnpm db:migrate:electives`，再执行 `pnpm db:migrate:elective-catalog`；全新环境执行
`pnpm db:init` 后再执行目录迁移。本地开发分别使用对应的 `:local` 脚本。官方通知说明最终
课程以教学管理系统实际开设为准，目录更新时应重新核对官方附件再生成迁移。

## 参考项目

### 后端

- [wuyilingwei/Waline_On_Worker](https://github.com/wuyilingwei/Waline_On_Worker)
