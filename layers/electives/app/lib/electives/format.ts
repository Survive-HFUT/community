/** 1–5 分显示成一位小数；0 表示还没有评分 */
export function formatScore(value: number): string {
  return value > 0 ? value.toFixed(1) : '—';
}

/** 评分转百分比宽度，用于均分条 */
export function scorePercent(value: number): number {
  return Math.min(100, Math.max(0, (value / 5) * 100));
}

/** ISO 时间字符串 → `YYYY-MM-DD` */
export function formatDate(value?: string): string {
  return value ? value.slice(0, 10) : '—';
}

/**
 * 从 `$fetch` 抛出的错误里取出可读文案。
 *
 * 服务端用 `createError({ statusCode, data: { message } })` 返回中文提示，
 * `$fetch` 会把它放在 `error.data.message`。
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const candidate = error as
    | { data?: { message?: string }; statusMessage?: string; message?: string }
    | undefined;
  return (
    candidate?.data?.message ||
    candidate?.statusMessage ||
    candidate?.message ||
    fallback
  );
}
