/**
 * 让 server 侧可以使用 D1Database / D1PreparedStatement 等 Cloudflare 全局类型。
 *
 * 该文件位于 layer 的 server 目录下，只会被 Nitro 的 server tsconfig 收录，
 * 不会污染 app 侧的 DOM 类型（workers-types 会重新声明 Request/Response 等）。
 */
/// <reference types="@cloudflare/workers-types" />
