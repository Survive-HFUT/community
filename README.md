# 活在肥宣社区

## Layers

不同业务通过 Nuxt layers 进行注册和管理

- `layers/waline` - Waline 后端服务
- `layers/electives` - 选修课评价

### 数据库

选修课课程与评价使用同一个 D1。课程匹配目录随 `layers/electives/server/electives/official-data.ts`
发布，内容是合肥工业大学宣城校区教务处 2026-2027 学年第一学期公开通知的版本化快照；
用户提交的新课程与评价持久化到 D1。已有 Waline 数据库的环境执行
`pnpm db:migrate:electives`；全新环境可执行 `pnpm db:init`。本地开发对应
`pnpm db:migrate:electives:local` 和 `pnpm db:init:local`。官方通知说明最终课程以教学管理
系统实际开设为准，目录更新时应重新核对官方附件再替换快照。

## 参考项目

### 后端

- [wuyilingwei/Waline_On_Worker](https://github.com/wuyilingwei/Waline_On_Worker)
