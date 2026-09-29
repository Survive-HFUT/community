# 活在肥宣社区

## Layers

不同业务通过 Nuxt layers 进行注册和管理

- `layers/waline` - Waline 后端服务
- `layers/electives` - 选修课评价

### 数据库

选修课课程与评价使用同一个 D1，用户提交的新课程与评价持久化到 D1。已有 Waline
数据库的环境执行 `pnpm db:migrate:electives`；全新环境可执行 `pnpm db:init`。本地开发对应
`pnpm db:migrate:electives:local` 和 `pnpm db:init:local`。

## 参考项目

### 后端

- [wuyilingwei/Waline_On_Worker](https://github.com/wuyilingwei/Waline_On_Worker)
