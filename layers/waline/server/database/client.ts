/**
 * Drizzle ORM 客户端工厂。
 *
 * 数据访问层（`server/database/**`）统一用 `getDb(d1)` 把 Cloudflare 的
 * `D1Database` 绑定包成 Drizzle 实例，之后所有查询都用 Drizzle 的语义化
 * API 构造，不再手写 SQL 字符串。
 *
 * 为什么在**这里**做适配而不是改所有调用方：
 *   - `server/database/**` 本来就是「D1 的唯一出口」，调用方只传 `env.DB`；
 *   - 保持仓库层函数签名不变（仍收 `D1Database`），业务层零改动、零回归风险。
 *
 * 实例按绑定对象缓存（WeakMap）：同一请求内多次调用只会创建一次。
 */
import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema';

export type WalineDB = DrizzleD1Database<typeof schema>;

const cache = new WeakMap<D1Database, WalineDB>();

/** 把 D1 绑定包装成 Drizzle 实例（同一个绑定只创建一次） */
export function getDb(d1: D1Database): WalineDB {
  if (!d1) {
    throw new Error('D1 binding `DB` is unavailable');
  }

  let db = cache.get(d1);
  if (!db) {
    db = drizzle(d1, { schema });
    cache.set(d1, db);
  }
  return db;
}
